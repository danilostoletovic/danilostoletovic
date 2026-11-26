import { defineConfig } from 'astro/config';
import { site } from './src/data/public.ts';
import { generateSiteArtifacts } from './src/lib/site-build.ts';

export default defineConfig({
  output: 'static',
  site,
  trailingSlash: 'always',
  build: { inlineStylesheets: 'always' },
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [{
    name: 'static-site-metadata',
    hooks: { 'astro:build:done': generateSiteArtifacts },
  }],
});
