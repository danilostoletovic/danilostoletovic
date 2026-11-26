import { createServer } from 'node:http';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from '@playwright/test';
import lighthouse, { desktopConfig } from 'lighthouse';

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css',
  '.png': 'image/png', '.avif': 'image/avif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain',
};

async function serve(directory) {
  const root = resolve(directory);
  await access(resolve(root, 'index.html'));
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url, 'http://localhost').pathname;
      const file = resolve(root, '.' + path + (path.endsWith('/') ? 'index.html' : ''));
      if (!file.startsWith(root + sep)) throw new Error('Path outside build');
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((done, fail) => server.once('error', fail).listen(0, '127.0.0.1', done));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

async function debuggingPort() {
  const listener = createServer();
  await new Promise((done, fail) => listener.once('error', fail).listen(0, '127.0.0.1', done));
  const { port } = listener.address();
  await new Promise((done, fail) => listener.close(error => error ? fail(error) : done()));
  return port;
}

await mkdir('.research/lighthouse', { recursive: true });
const reports = [];
for (const [name, dir] of [['baseline', '.research/baseline'], ['candidate', 'dist']]) {
  const { server, url } = await serve(dir);
  try {
    for (const form of ['mobile', 'desktop']) {
      const file = `.research/lighthouse/${name}-${form}.json`;
      const port = await debuggingPort();
      const browser = await chromium.launch({ args: ['--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${port}`] });
      try {
        const { lhr } = await lighthouse(url, {
          port, logLevel: 'error', output: 'json',
          onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
          blockedUrlPatterns: ['https://cloud.umami.is/*'],
        }, form === 'desktop' ? desktopConfig : undefined);
        await writeFile(file, JSON.stringify(lhr, null, 2));
        const { categories, audits, runtimeError } = lhr;
        if (runtimeError) throw new Error(runtimeError.message);
        const record = {
          name, form,
          scores: Object.fromEntries(Object.entries(categories).map(([id, category]) => [id, category.score === null ? null : Math.round(100 * category.score)])),
          lab: Object.fromEntries(['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'total-byte-weight'].map(id => [id, Math.round(audits[id].numericValue * 1000) / 1000])),
        };
        reports.push(record);
        console.log(JSON.stringify(record));
      } finally {
        await browser.close();
      }
    }
  } finally {
    server.close();
  }
}
await writeFile('.research/lighthouse/summary.json', JSON.stringify(reports, null, 2));
