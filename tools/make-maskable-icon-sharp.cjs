const sharp = require('sharp');
const path = require('path');

(async () => {
  try {
    const publicDir = path.join(__dirname, '..', 'public');
    const srcPath = path.join(publicDir, 'icon-512.png');
    const outPath = path.join(publicDir, 'icon-512-maskable.png');
    const SIZE = 512;
    const SAFE_RATIO = 0.80;
    const target = Math.round(SIZE * SAFE_RATIO);

    const resized = await sharp(srcPath).resize({ width: target, height: target, fit: 'inside' }).png().toBuffer();

    await sharp({
      create: {
        width: SIZE,
        height: SIZE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{ input: resized, left: Math.round((SIZE - target) / 2), top: Math.round((SIZE - target) / 2) }])
      .png()
      .toFile(outPath);

    console.log('Wrote maskable icon (sharp) to', outPath);
  } catch (err) {
    console.error('Failed to generate maskable icon (sharp):', err);
    process.exitCode = 1;
  }
})();
