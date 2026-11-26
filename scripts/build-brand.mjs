import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const input = fileURLToPath(new URL('../assets/brand/ds-monogram.png', import.meta.url));
const dir = fileURLToPath(new URL('../public/brand/', import.meta.url));
await mkdir(dir, { recursive: true });
const { width, height, hasAlpha } = await sharp(input).metadata();
if (width !== 1536 || height !== 1024 || !hasAlpha) {
  throw new Error('Expected the original transparent 1536 × 1024 DS monogram.');
}
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const socialBackground = '#837d77';
// Crop the wide transparent margins to keep the supplied mark legible at small sizes.
const thumb = await sharp(input).extract({ left: 301, top: 155, width: 934, height: 735 }).png().toBuffer();
const sizes = [[64, 'favicon'], [180, 'apple-touch-icon'], [192, 'icon-192'], [512, 'icon-512']];
await Promise.all([
  sharp(input).resize(768).webp({ quality: 87, alphaQuality: 100 }).toFile(dir + 'monogram.webp'),
  sharp(input).resize(945, 630)
    .extend({ left: 127, right: 128, top: 0, bottom: 0, background: socialBackground })
    .flatten({ background: socialBackground }).png().toFile(dir + 'social.png'),
  ...sizes.map(([size, name]) => sharp(thumb)
    .resize(size, size, { fit: 'contain', background: transparent })
    .png().toFile(`${dir}${name}.png`)),
]);
