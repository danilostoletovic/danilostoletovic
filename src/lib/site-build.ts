import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { person, site } from '../data/public.ts';
import { portraitAssets } from '../data/portrait.ts';
import { absolute, contentSignal, discovery } from '../config/discovery.ts';
import { markdownAssetPath, markdownCollections, markdownPath, markdownWorkerRoutes } from '../config/markdown.ts';
import { mcpService } from '../config/mcp.ts';
import { a2a } from '../config/a2a.ts';
import { securityHeaders } from '../config/security.ts';
import { citationFormats } from './citations.ts';
import { pageMarkdown, xml } from './artifacts.ts';
import { discoveryArtifacts, type Artifact } from './discovery-artifacts.ts';

type Headers = Record<string, string>;
const headerBlock = (path: string, headers: Headers) => path + '\n' + Object.entries(headers).map(([key, value]) => `  ${key}: ${value}`).join('\n');
const webLink = (path: string, rel: string, type?: string) => `<${absolute(path)}>; rel="${rel}"${type ? `; type="${type}"` : ''}`;

async function writeArtifact(dir: URL, path: string, body: string) {
  // Filesystem conversion must preserve literal characters in generated filenames.
  const target = resolve(fileURLToPath(dir), '.' + path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, body);
}

export async function generateSiteArtifacts({ pages, dir }: { pages: { pathname: string }[]; dir: URL }) {
  const [themeScript, wranglerText] = await Promise.all([
    readFile(new URL('../scripts/theme.js', import.meta.url), 'utf8'),
    readFile(new URL('../../wrangler.jsonc', import.meta.url), 'utf8'),
  ]);
  // This project keeps Wrangler's config JSON-compatible. Catch drift at the deployment boundary.
  const wrangler = JSON.parse(wranglerText);
  const workerRoutes = [mcpService.path, mcpService.path + '/', a2a.path + '/*', ...markdownWorkerRoutes];
  if (workerRoutes.some(path => !wrangler.assets.run_worker_first.includes(path)) || wrangler.assets.run_worker_first.length !== workerRoutes.length) {
    throw new Error('Wrangler Worker-first routes must match the MCP, A2A, and Markdown runtime configuration.');
  }
  const canonicalPages = [...new Set(pages
    .filter(({ pathname }) => !pathname.includes('.') && !/^\/?(?:404|500)\/?$/.test(pathname))
    .map(({ pathname }) => new URL(pathname.replace(/\/?$/, '/'), site + '/').pathname))].sort();
  const content = pageMarkdown();
  const hash = createHash('sha256').update(themeScript.replace(/\r\n?/g, '\n')).digest('base64');
  const headers = [
    headerBlock('/*', { ...securityHeaders(hash), 'Content-Signal': contentSignal }),
    headerBlock('/_astro/*', { 'Cache-Control': 'public, max-age=31536000, immutable' }),
    headerBlock('/brand/*', { 'Cache-Control': 'public, max-age=86400' }),
    ...portraitAssets.map(({ url, mimeType }) => headerBlock(new URL(url).pathname, {
      'Content-Type': mimeType, 'Cache-Control': 'public, max-age=86400',
    })),
    headerBlock('/deployment-version.txt', { 'Cache-Control': 'no-store' }),
    headerBlock('/rss.xml', { 'Content-Type': 'application/rss+xml; charset=utf-8' }),
    headerBlock('/site.webmanifest', { 'Content-Type': 'application/manifest+json; charset=utf-8' }),
    headerBlock('/cv.pdf', { 'Content-Type': 'application/pdf' }),
    ...Object.entries(citationFormats).map(([name, format]) => headerBlock(`/academia/:id/${name}`, { 'Content-Type': format.contentType })),
  ];
  const artifacts: Artifact[] = discoveryArtifacts();
  for (const artifact of artifacts) {
    if (artifact.path.startsWith('/.well-known/agent-skills/') && artifact.path.endsWith('/SKILL.md')) continue;
    headers.push(headerBlock(artifact.path, {
      'Content-Type': artifact.type,
      'Cache-Control': 'public, max-age=0, must-revalidate',
      ...(artifact.path === discovery.ard.path ? { 'Access-Control-Allow-Origin': '*' } : {}),
    }));
  }
  headers.push(headerBlock('/.well-known/agent-skills/:name/SKILL.md', {
    'Content-Type': discovery.markdownType + '; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate',
  }));
  const markdownLinks = (path: string, markdown: string) => {
    const links = [webLink(markdown, 'alternate', discovery.markdownType)];
    if (path === '/' || path === discovery.integrationGuide.path) {
      links.push(webLink(discovery.apiCatalog.path, discovery.apiCatalog.rel, discovery.apiCatalog.type),
        webLink(discovery.ard.path, discovery.ard.rel, discovery.ard.type));
    }
    if (path === discovery.integrationGuide.path) links.push(webLink(mcpService.cardPath, 'service-meta', mcpService.cardType));
    headers.push(headerBlock(path, {
      Vary: 'Accept', Link: links.join(', '), 'Cache-Control': 'public, max-age=0, must-revalidate, no-transform',
    }));
    headers.push(headerBlock(markdown, {
      'Content-Type': discovery.markdownType + '; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      Link: webLink(path, 'canonical'),
    }));
  };
  for (const path of canonicalPages) {
    const markdown = markdownPath(path);
    const body = content.get(path);
    if (!markdown || !body) throw new Error(`Missing Markdown source for canonical page ${path}`);
    if (path !== '/') artifacts.push({ path: markdown, type: discovery.markdownType, body });
    if (path.split('/').length <= 3) markdownLinks(path, markdown);
    content.delete(path);
  }
  for (const section of markdownCollections) markdownLinks(`/${section}/:id/`, markdownAssetPath(section, ':id'));
  if (content.size) throw new Error(`Markdown refers to missing canonical pages: ${[...content.keys()].join(', ')}`);
  const portraitEntry = `<image:image><image:loc>${xml(person.image.url)}</image:loc></image:image>`;
  const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
    + canonicalPages.map(path => `  <url><loc>${xml(absolute(path))}</loc>${path === '/' ? portraitEntry : ''}</url>`).join('\n') + '\n</urlset>\n';
  const headerFile = headers.join('\n\n') + '\n';
  if (headers.length > 100 || headerFile.split('\n').some(line => line.length > 2000)) {
    throw new Error('Generated _headers exceeds Cloudflare Workers Assets limits.');
  }
  await Promise.all([
    writeArtifact(dir, discovery.sitemap, sitemap),
    writeArtifact(dir, '/_headers', headerFile),
    ...artifacts.map(artifact => writeArtifact(dir, artifact.path, artifact.body)),
  ]);
}
