import { defineConfig } from 'astro/config';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { site } from './src/data/public.ts';

const escapeXml = value => value.replace(/[<>&"']/g, character => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
}[character]));

export default defineConfig({
  output: 'static',
  site,
  trailingSlash: 'always',
  build: { inlineStylesheets: 'always' },
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [{
    name: 'static-site-metadata',
    hooks: {
      'astro:build:done': async ({ pages, dir }) => {
        const urls = [...new Set(pages
          .filter(({ pathname }) => !pathname.includes('.') && !/^\/?(?:404|500)\/?$/.test(pathname))
          .map(({ pathname }) => new URL(pathname.replace(/\/?$/, '/'), `${site}/`).href))].sort();
        const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
          + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          + urls.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')
          + '\n</urlset>\n';
        const headersPath = new URL('_headers', dir);
        const [headers, themeScript] = await Promise.all([
          readFile(headersPath, 'utf8'),
          readFile(new URL('./src/scripts/theme.js', import.meta.url), 'utf8'),
        ]);
        const hash = createHash('sha256').update(themeScript.replace(/\r\n?/g, '\n')).digest('base64');
        await Promise.all([
          writeFile(new URL('sitemap.xml', dir), sitemap),
          writeFile(headersPath, headers.replace('__THEME_SCRIPT_HASH__', `'sha256-${hash}'`)),
        ]);
      }
    }
  }]
});
