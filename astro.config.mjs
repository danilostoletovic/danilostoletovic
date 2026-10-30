import { defineConfig } from 'astro/config';
import { writeFile } from 'node:fs/promises';

const site = 'https://danilostoletovic.com';
const escapeXml = value => value.replace(/[<>&"']/g, character => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
}[character]));

export default defineConfig({
  output: 'static',
  site,
  integrations: [{
    name: 'build-sitemap',
    hooks: {
      'astro:build:done': async ({ pages, dir }) => {
        const urls = [...new Set(pages
          .filter(({ pathname }) => !/^\/?(?:404|500)(?:\.html|\/)?$/.test(pathname))
          .map(({ pathname }) => new URL(pathname, `${site}/`).href))].sort();
        const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
          + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          + urls.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')
          + '\n</urlset>\n';
        await Promise.all([
          writeFile(new URL('sitemap.xml', dir), sitemap),
          writeFile(new URL('robots.txt', dir), `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`)
        ]);
      }
    }
  }]
});
