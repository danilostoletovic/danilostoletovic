import { site } from '../config/site.ts';

const filename = 'danilo-stoletovic';
const fullWidth = 800;
const widths = [320, 480, 640, fullWidth];

function imageAsset(format: 'jpeg' | 'avif' | 'webp', width = fullWidth) {
  const extension = format === 'jpeg' ? 'jpg' : format;
  const suffix = width === fullWidth ? '' : `-${width}`;
  return { url: `${site}/images/${filename}${suffix}.${extension}`, width, height: width, mimeType: `image/${format}` as const };
}

export const portraitJpeg = imageAsset('jpeg');
export const portraitSources = (['avif', 'webp'] as const).map(format => widths.map(width => imageAsset(format, width)));
export const portraitAssets = [portraitJpeg, ...portraitSources.flat()];
export const portraitAlternatives = portraitSources.map(variants => variants[variants.length - 1]);
