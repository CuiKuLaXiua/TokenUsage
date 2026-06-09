/**
 * 从 logo_full.png 生成圆角图标
 * - logo_rounded.png  (256x256, r=50) — 窗口图标、侧边栏
 * - logo_tray.png     (64x64,  r=14) — 托盘图标 (2x retina)
 *
 * 用法: node scripts/generate-icons.mjs
 */
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);
const sharp = _require('sharp');

const PUBLIC_DIR = join(__dirname, '..', 'public');
const BUILD_DIR = join(__dirname, '..', 'build');
const SRC = join(__dirname, '..', 'logo_full.png');

// 创建圆角矩形的 SVG mask
function roundedRectSVG(w, h, r) {
  return Buffer.from(
    `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`
  );
}

async function generate() {
  console.log('源文件:', SRC);

  // --- 窗口/侧边栏图标: 256x256 ---
  await sharp(SRC)
    .resize(256, 256, { fit: 'cover' })
    .composite([{ input: roundedRectSVG(256, 256, 50), blend: 'dest-in' }])
    .png()
    .toFile(join(PUBLIC_DIR, 'logo_rounded.png'));
  console.log('→ public/logo_rounded.png  (256x256, r=50)');

  // --- 托盘图标: 64x64 (2x retina for 32x32 actual) ---
  await sharp(SRC)
    .resize(64, 64, { fit: 'cover' })
    .composite([{ input: roundedRectSVG(64, 64, 14), blend: 'dest-in' }])
    .png()
    .toFile(join(PUBLIC_DIR, 'logo_tray.png'));
  console.log('→ public/logo_tray.png     (64x64, r=14)');

  // --- 安装包图标 PNG: 1024x1024 ---
  await sharp(SRC)
    .resize(1024, 1024, { fit: 'cover' })
    .png()
    .toFile(join(BUILD_DIR, 'icon.png'));
  console.log('→ build/icon.png           (1024x1024, source: logo_full.png)');

  // --- 安装包图标 ICO: 256x256 + 48x48 + 32x32 + 16x16 ---
  const pngToIco = _require('png-to-ico');
  const sizes = [256, 48, 32, 16];
  const icoBuffers = [];
  for (const size of sizes) {
    const buf = await sharp(SRC)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toBuffer();
    icoBuffers.push(buf);
  }
  const icoFn = pngToIco.default || pngToIco.imagesToIco || pngToIco;
  const icoBuffer = await icoFn(icoBuffers);
  writeFileSync(join(BUILD_DIR, 'icon.ico'), icoBuffer);
  console.log('→ build/icon.ico           (256/48/32/16, source: logo_full.png)');

  // --- 安装包圆角图标: 256x256 ---
  await sharp(SRC)
    .resize(256, 256, { fit: 'cover' })
    .composite([{ input: roundedRectSVG(256, 256, 50), blend: 'dest-in' }])
    .png()
    .toFile(join(BUILD_DIR, 'icon_rounded.png'));
  console.log('→ build/icon_rounded.png   (256x256, r=50)');

  console.log('\n所有圆角图标生成完成！');
}

generate().catch(err => {
  console.error('生成失败:', err);
  process.exit(1);
});
