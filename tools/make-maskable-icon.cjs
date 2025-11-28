const { Jimp } = require('jimp');
const path = require('path');

(async () => {
  try {
    const publicDir = path.join(__dirname, '..', 'public');
    const srcPath = path.join(publicDir, 'icon-512.png');
    const outPath = path.join(publicDir, 'icon-512-maskable.png');
    const SIZE = 512;
    const SAFE_RATIO = 0.80; // scale source to 80% so edges are safe for mask

    const src = await Jimp.read(srcPath);

    // create transparent canvas
    const out = new Jimp(SIZE, SIZE, 0x00000000);

    // scale the source to fit within the safe area while preserving aspect
    const target = Math.round(SIZE * SAFE_RATIO);
    src.contain(target, target, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);

    const x = Math.round((SIZE - target) / 2);
    const y = Math.round((SIZE - target) / 2);

    out.composite(src, x, y, {
      mode: Jimp.BLEND_SOURCE_OVER,
      opacitySource: 1,
      opacityDest: 1,
    });

    await out.writeAsync(outPath);
    console.log('Wrote maskable icon to', outPath);
  } catch (err) {
    console.error('Failed to generate maskable icon:', err);
    process.exitCode = 1;
  }
})();
