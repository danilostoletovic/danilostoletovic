import type { APIRoute, GetStaticPaths } from 'astro';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { portraitAssets } from '../../data/portrait';

export const getStaticPaths = (() => portraitAssets.map(asset => ({
  params: { portrait: new URL(asset.url).pathname.split('/').pop() },
  props: { asset },
}))) satisfies GetStaticPaths;

export const GET: APIRoute<{ asset: typeof portraitAssets[number] }> = async ({ props: { asset } }) => {
  const background = '#f7f6f2';
  const image = sharp(resolve('assets/danilo-stoletovic.png')).autoOrient().toColourspace('srgb')
    .resize(asset.width, asset.height, { fit: 'contain', background }).flatten({ background });
  // Sharp discards source metadata unless metadata retention is requested.
  if (asset.mimeType === 'image/avif') image.avif({ quality: 54, effort: 6 });
  else if (asset.mimeType === 'image/webp') image.webp({ quality: 82 });
  else image.jpeg({ quality: 87, mozjpeg: true });

  return new Response(new Uint8Array(await image.toBuffer()), { headers: { 'Content-Type': asset.mimeType } });
};
