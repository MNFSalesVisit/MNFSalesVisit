const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function detectNonTransparentBBox(buffer) {
  const img = sharp(buffer);
  const { width, height } = await img.metadata();
  const raw = await img.raw().ensureAlpha().toBuffer();

  let minX = width, minY = height, maxX = 0, maxY = 0;
  const alphaThreshold = 10;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const a = raw[idx + 3];
      if (a > alphaThreshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX > maxX || minY > maxY) return { left: 0, top: 0, width, height };
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

(async () => {
  try {
    const publicDir = path.join(__dirname, '..', 'public');
    const srcPath = path.join(publicDir, 'icon-512.png');
    if (!fs.existsSync(srcPath)) throw new Error('Source icon not found: ' + srcPath);
    const buffer = fs.readFileSync(srcPath);

    const bbox = await detectNonTransparentBBox(buffer);
    const cropped = await sharp(buffer).extract(bbox).png().toBuffer();

    const SIZE = 512;
    const ratio = 0.68;
    const target = Math.round(SIZE * ratio);
    const offsetDown = 30; // px to move down

    const resized = await sharp(cropped).resize({ width: target, height: target, fit: 'inside' }).png().toBuffer();

    const left = Math.round((SIZE - target) / 2);
    const top = Math.round((SIZE - target) / 2) + offsetDown;

    const outPath = path.join(publicDir, 'icon-512-maskable-auto-68-offset-30.png');

    await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r:0,g:0,b:0,alpha:0 } } })
      .composite([{ input: resized, left, top }])
      .png()
      .toFile(outPath);

    console.log('Wrote offset icon to', outPath);
  } catch (err) {
    console.error('Error generating offset icon:', err);
    process.exitCode = 1;
  }
})();
