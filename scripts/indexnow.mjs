import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { deploymentVersionPath, indexNowKey, indexNowKeyPath, indexNowManifestPath } from '../src/config/indexnow.ts';
import { site } from '../src/config/site.ts';

const origin = new URL(site).origin;
const sha = /^[a-f0-9]{40}$/;
const stateRef = 'refs/heads/indexnow-state';
const stateFile = 'manifest.json';
const batchSize = 10_000;

export function parseManifest(value, { checkpoint = false } = {}) {
  if (value?.version !== 1 || typeof value.release !== 'string' || !sha.test(value.release)
      || !value.urls || typeof value.urls !== 'object' || Array.isArray(value.urls)) {
    throw new Error('Invalid IndexNow manifest.');
  }
  const entries = Object.entries(value.urls);
  if (!checkpoint && !entries.length) throw new Error('Production IndexNow manifest is empty.');
  for (const [url, fingerprint] of entries) {
    const parsed = new URL(url);
    if (parsed.href !== url || parsed.origin !== origin || parsed.username || parsed.password ||
        parsed.search || parsed.hash || !parsed.pathname.endsWith('/') ||
        typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint)) {
      throw new Error('Invalid canonical URL or fingerprint in IndexNow manifest.');
    }
  }
  return new Map(entries);
}

export function changesSince(previous, current) {
  const added = [], modified = [], removed = [];
  for (const [url, digest] of current) {
    if (!previous.has(url)) added.push(url);
    else if (previous.get(url) !== digest) modified.push(url);
  }
  for (const url of previous.keys()) {
    if (!current.has(url)) removed.push(url);
  }
  return { added, modified, removed };
}

async function request(url, options = {}) {
  return fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), ...options });
}

async function productionFile(path) {
  const response = await request(new URL(path, origin), { headers: { 'Cache-Control': 'no-cache' } });
  if (response.status === 200) return response;
  await response.body?.cancel();
  throw new Error(`Production asset returned HTTP ${response.status}.`);
}

async function liveRelease() {
  return (await (await productionFile(deploymentVersionPath)).text()).trim();
}

async function liveManifest(expected) {
  const deadline = Date.now() + (expected ? 360_000 : 15_000);
  do {
    let reason = 'Waiting for the expected Cloudflare release.';
    try {
      const release = await liveRelease();
      if (sha.test(release) && (!expected || release === expected)) {
        const manifest = await (await productionFile(indexNowManifestPath)).json();
        if (manifest.release === release) return manifest;
        reason = 'The release marker and manifest are temporarily out of sync.';
      }
    } catch {
      reason = 'Waiting for the production release marker and manifest.';
    }
    if (Date.now() >= deadline) {
      if (!expected) throw new Error(reason);
      console.log(`${reason} The scheduled workflow will reconcile the live release.`);
      return;
    }
    console.log(reason);
    await delay(expected ? 10_000 : 3_000);
  } while (true);
}

async function verifyPage(url) {
  const response = await request(url, { headers: { Accept: 'text/html', 'Cache-Control': 'no-cache' } });
  const html = await response.text();
  const noindex = /\b(?:noindex|none)\b/i;
  if (response.status !== 200 || !html.includes(`<link rel="canonical" href="${url}">`) ||
      noindex.test(response.headers.get('X-Robots-Tag') ?? '') ||
      /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*\b(?:noindex|none)\b/i.test(html)) {
    throw new Error(`Canonical page is not indexable on the live release: ${url}`);
  }
}

async function verifyKey(key) {
  const response = await productionFile(indexNowKeyPath(key));
  if (!response.headers.get('content-type')?.startsWith('text/plain') || await response.text() !== key) {
    throw new Error('The configured IndexNow verification file is missing or incorrect on production.');
  }
}

export async function submitBatch(key, urlList, { beforeSend, send = request, wait = delay } = {}) {
  const payload = {
    host: new URL(origin).hostname,
    key,
    keyLocation: new URL(indexNowKeyPath(key), origin).href,
    urlList,
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    await beforeSend?.();
    const response = await send('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
    await response?.body?.cancel();
    const status = response?.status;
    if (status === 200 || status === 202) {
      console.log(`IndexNow accepted ${urlList.length} URL(s), HTTP ${status}.`);
      return;
    }
    if (attempt === 3 || (status && status !== 429 && status < 500)) {
      throw new Error(`IndexNow submission failed: ${status ? `HTTP ${status}` : 'network error'}.`);
    }
    const retryAfter = response?.headers.get('Retry-After');
    const requestedDelay = retryAfter
      ? (/^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now())
      : 0;
    if (requestedDelay > 60_000) throw new Error('IndexNow requested a retry later. The next workflow will retry.');
    const retryDelay = Math.max(1000 * 2 ** attempt, requestedDelay || 0);
    console.warn(`IndexNow returned ${status ?? 'a network error'}. Retrying in ${retryDelay} ms.`);
    await wait(retryDelay);
  }
}

function git(args, input) {
  return execFileSync('git', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'inherit'] }).trim();
}

function checkpoint() {
  const remote = git(['ls-remote', '--refs', 'origin', stateRef]);
  if (!remote) return { previous: new Map(), parent: undefined };
  git(['fetch', '--no-tags', '--depth=1', 'origin', stateRef]);
  const parent = git(['rev-parse', 'FETCH_HEAD']);
  const state = JSON.parse(git(['show', `${parent}:${stateFile}`]));
  return { previous: parseManifest(state, { checkpoint: true }), parent };
}

function saveCheckpoint(release, previous, parent) {
  // An orphan history keeps checkpoints out of the deploy branch and preserves them beyond artifact retention.
  const snapshot = JSON.stringify({ version: 1, release, urls: Object.fromEntries([...previous].sort()) }, null, 2) + '\n';
  const blob = git(['hash-object', '-w', '--stdin'], snapshot);
  const tree = git(['mktree'], `100644 blob ${blob}\t${stateFile}\n`);
  const commit = git([
    '-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
    'commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', `Record URLs accepted by IndexNow for ${release}`,
  ]);
  git(['push', 'origin', `${commit}:${stateRef}`]);
  return commit;
}

async function main() {
  const key = indexNowKey();
  if (!key) {
    console.log('IndexNow is disabled until INDEXNOW_KEY is configured.');
    return;
  }
  const expected = process.env.INDEXNOW_DEPLOY_SHA;
  if (expected && !sha.test(expected)) throw new Error('Invalid expected deployment SHA.');
  const manifest = await liveManifest(expected);
  if (!manifest) return;
  const current = parseManifest(manifest);
  const { release } = manifest;
  let { previous, parent } = checkpoint();
  const { added, modified, removed } = changesSince(previous, current);
  console.log(`Production ${release}: ${added.length} added, ${modified.length} modified, ${removed.length} removed.`);
  const changed = [...added, ...modified, ...removed];
  if (!changed.length) return;

  await verifyKey(key);
  for (let offset = 0; offset < changed.length; offset += batchSize) {
    const batch = changed.slice(offset, offset + batchSize);
    const livePages = batch.filter(url => current.has(url));
    for (let i = 0; i < livePages.length; i += 8) {
      await Promise.all(livePages.slice(i, i + 8).map(verifyPage));
    }
    await submitBatch(key, batch, {
      beforeSend: async () => {
        if (await liveRelease() !== release) throw new Error('Production changed before submission. The next workflow will reconcile the new release.');
      },
    });
    for (const url of batch) {
      if (current.has(url)) previous.set(url, current.get(url));
      else previous.delete(url);
    }
    parent = saveCheckpoint(release, previous, parent);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch(error => {
    console.error(`IndexNow: ${error.message}`);
    process.exitCode = 1;
  });
}
