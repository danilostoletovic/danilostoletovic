import type { APIRoute, GetStaticPaths } from 'astro';
import { catalogue, validateCatalogue } from '../lib/catalogue';
import { anaKnowledge, llmsIndex, newsRss, profileMarkdown, textCatalogue } from '../lib/artifacts';
import { makeCvPdf } from '../lib/cv-pdf';
import { person, site } from '../data/public';
import { key } from '../data/indexnow.json';

const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const mimetypes = {
  json: 'application/json; charset=utf-8', txt: 'text/plain; charset=utf-8', md: 'text/markdown; charset=utf-8',
  xml: 'application/rss+xml; charset=utf-8', webmanifest: 'application/manifest+json; charset=utf-8', pdf: 'application/pdf',
};
const paths = [
  ...Object.keys(catalogue).map(name => name + '.json'), 'mcp-data.json', 'ana-knowledge.json', 'llms.txt', 'llms-full.txt',
  'profile.md', 'cv.pdf', 'rss.xml', 'site.webmanifest', 'robots.txt', key + '.txt', 'deployment-version.txt',
];

export const getStaticPaths = (() => {
  validateCatalogue();
  return paths.map(artifact => ({ params: { artifact } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
  const filename = params.artifact!;
  const extension = filename.split('.').pop() as keyof typeof mimetypes;
  const headers = { 'Content-Type': mimetypes[extension] };
  let body: BodyInit;
  switch (filename) {
    case 'cv.pdf': body = new Uint8Array(await makeCvPdf()); break;
    case 'llms.txt': body = llmsIndex(); break;
    case 'llms-full.txt': body = textCatalogue(); break;
    case 'profile.md': body = profileMarkdown(); break;
    case 'rss.xml': body = newsRss(); break;
    case 'robots.txt': body = `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`; break;
    case 'mcp-data.json': body = json(catalogue); break;
    case 'ana-knowledge.json': body = json(anaKnowledge); break;
    case 'deployment-version.txt':
      body = (process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.INDEXNOW_DEPLOY_SHA || 'local') + '\n';
      break;
    case key + '.txt': body = key; break;
    case 'site.webmanifest':
      body = json({
        name: person.name, short_name: 'D. Stoletović', start_url: '/', scope: '/', display: 'standalone',
        background_color: '#f7f6f2', theme_color: '#f7f6f2',
        icons: [192, 512].map(size => ({ src: `/brand/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })),
      });
      break;
    default: body = json(catalogue[filename.slice(0, -5) as keyof typeof catalogue]); break;
  }
  return new Response(body, { headers });
};
