const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function detectNonTransparentBBox(buffer) {
  const img = sharp(buffer);
  const { width, height, channels } = await img.metadata();
  const raw = await img.raw().ensureAlpha().toBuffer();

  let minX = width, minY = height, maxX = 0, maxY = 0;
  const alphaThreshold = 10; // alpha > this considered visible

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4; // RGBA
      const a = raw[idx + 3];
      if (a > alphaThreshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    // no visible pixels -> return full image
    return { left: 0, top: 0, width, height };
  }

  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function makeVariants() {
  try {
    const publicDir = path.join(__dirname, '..', 'public');
    const srcPath = path.join(publicDir, 'icon-512.png');
    if (!fs.existsSync(srcPath)) throw new Error('source icon not found: ' + srcPath);
    const srcBuffer = fs.readFileSync(srcPath);

    const bbox = await detectNonTransparentBBox(srcBuffer);

    const SIZE = 512;
    const variants = [0.72, 0.68, 0.64, 0.56];

    // extract the visible area
    const croppedBuf = await sharp(srcBuffer).extract(bbox).png().toBuffer();

    for (const ratio of variants) {
      const target = Math.round(SIZE * ratio);
      const resized = await sharp(croppedBuf).resize({ width: target, height: target, fit: 'inside' }).png().toBuffer();

      const left = Math.round((SIZE - target) / 2);
      const top = Math.round((SIZE - target) / 2);

      const outPath = path.join(publicDir, `icon-512-maskable-auto-${Math.round(ratio*100)}.png`);
      await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r:0,g:0,b:0,alpha:0 } } })
        .composite([{ input: resized, left, top }])
        .png()
        .toFile(outPath);
      console.log('Wrote', outPath);
    }

    // also write a default auto file (use middle ratio)
    const defaultOut = path.join(publicDir, 'icon-512-maskable-auto.png');
    fs.copyFileSync(path.join(publicDir, `icon-512-maskable-auto-64.png`), defaultOut);
    console.log('Wrote default', defaultOut);
  } catch (err) {
    console.error('Failed to generate centered maskable icons:', err);
    process.exitCode = 1;
  }
}

makeVariants();
