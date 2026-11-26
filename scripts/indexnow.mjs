import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { host, key } from '../src/data/indexnow.json' with { type: 'json' };

const origin = `https://${host}`;
const sha = process.env.INDEXNOW_DEPLOY_SHA;
const requested = process.env.INDEXNOW_URL;
if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('An immutable production commit is required.');
if (!/^[a-f0-9]{64}$/.test(key) || host !== 'danilostoletovic.com') throw new Error('Invalid IndexNow configuration.');

const read = (url, options = {}) => fetch(url, {
  redirect: 'manual',
  headers: { 'Cache-Control': 'no-cache' },
  signal: AbortSignal.timeout(15_000),
  ...options,
});
const canonical = (html, url) => html.includes(`<link rel="canonical" href="${url}">`)
  && !/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*\b(?:noindex|none)\b/i.test(html);

const keyLocation = `${origin}/${key}.txt`;
const [marker, keyPage] = await Promise.all([read(origin + '/deployment-version.txt'), read(keyLocation)]);
if (marker.status !== 200 || (await marker.text()).trim() !== sha) throw new Error('The requested commit is not live.');
if (keyPage.status !== 200 || !keyPage.headers.get('content-type')?.startsWith('text/plain') || await keyPage.text() !== key) {
  throw new Error('The exact public IndexNow key is not live.');
}

const sitemap = await readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
const knownUrls = [...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]))];
if (requested && !knownUrls.includes(requested)) throw new Error('Choose an exact canonical URL from the generated production sitemap.');
const urlList = requested ? [requested] : knownUrls;
if (!urlList.length || urlList.length > 10_000) throw new Error('Invalid IndexNow batch size.');
for (const url of urlList) {
  const parsed = new URL(url);
  if (parsed.origin !== origin || parsed.username || parsed.password || parsed.search || parsed.hash || !/^\/(?:[a-z0-9-]+\/)*$/.test(parsed.pathname)) {
    throw new Error(`Invalid canonical URL: ${url}`);
  }
  const page = await read(url);
  if (page.status !== 200 || /\b(?:noindex|none)\b/i.test(page.headers.get('X-Robots-Tag') ?? '') || !canonical(await page.text(), url)) {
    throw new Error(`Canonical page was not indexable on production: ${url}`);
  }
}

for (let attempt = 0; attempt < 3; attempt++) {
  const result = await read('https://api.indexnow.org/indexnow', {
    method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, key, keyLocation, urlList }),
  }).catch(() => undefined);
  if (result) await result.body?.cancel();
  const status = result?.status;
  if (status === 200 || status === 202) {
    console.log(`IndexNow accepted ${urlList.length} URL(s) with HTTP ${status}.`);
    break;
  }
  if (attempt === 2 || (status && status !== 429 && status < 500)) throw new Error(`IndexNow submission failed with ${status ?? 'a network error'}.`);
  const retryAfter = result?.headers.get('Retry-After');
  const requestedDelay = retryAfter ? (Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now()) : 0;
  if (requestedDelay > 60_000) throw new Error('IndexNow requested a longer retry interval.');
  await delay(Math.max(Number.isFinite(requestedDelay) ? requestedDelay : 0, 1000 * 2 ** attempt));
}
