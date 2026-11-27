import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

function productionFile(path) {
  return request(new URL(path, origin), { headers: { 'Cache-Control': 'no-cache' } });
}

async function liveRelease() {
  const response = await productionFile(deploymentVersionPath);
  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error(`Production release marker returned HTTP ${response.status}.`);
  }
  return (await response.text()).trim();
}

async function waitForLiveRelease(expected) {
  const deadline = Date.now() + (expected ? 360_000 : 15_000);
  do {
    let reason = 'Waiting for the expected Cloudflare release.';
    try {
      const release = await liveRelease();
      if (sha.test(release) && (!expected || release === expected)) return release;
    } catch (error) {
      reason = `Could not read the production release marker: ${error.message}`;
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

function verifiedManifest(release) {
  const repo = process.env.GITHUB_REPOSITORY;
  const branch = process.env.INDEXNOW_PRODUCTION_BRANCH;
  if (!repo || !branch) throw new Error('GitHub repository and production branch are required.');
  const gh = args => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  const { workflow_runs: runs } = JSON.parse(gh([
    'api', '--method', 'GET', `repos/${repo}/actions/workflows/agentic.yml/runs`,
    '-f', `head_sha=${release}`, '-f', `branch=${branch}`, '-f', 'status=success',
  ]));
  const run = runs.find(record => record.head_sha === release && record.head_branch === branch &&
    record.head_repository?.full_name === repo && ['push', 'workflow_dispatch'].includes(record.event));
  if (!run) throw new Error(`No successful site verification run for live release ${release}.`);

  const directory = mkdtempSync(join(tmpdir(), 'indexnow-artifact-'));
  try {
    gh(['run', 'download', String(run.id), '--repo', repo, '--name', 'indexnow-manifest', '--dir', directory]);
    const manifest = JSON.parse(readFileSync(join(directory, indexNowManifestPath.slice(1)), 'utf8'));
    if (manifest.release !== release) throw new Error('The verified manifest does not match the live production commit.');
    return manifest;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

async function verifyKey(key) {
  const response = await productionFile(indexNowKeyPath(key));
  if (response.headers.get('cf-mitigated') === 'challenge') {
    await response.body?.cancel();
    console.log('Cloudflare challenged the verification request. IndexNow will validate ownership directly.');
    return;
  }
  if (response.status !== 200 || !response.headers.get('content-type')?.startsWith('text/plain') || await response.text() !== key) {
    throw new Error(`The configured IndexNow verification file is missing or incorrect on production (HTTP ${response.status}).`);
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
  return { previous: parseManifest(state, { checkpoint: true }), parent, completedRelease: state.complete === true ? state.release : undefined };
}

function saveCheckpoint(release, previous, parent, complete) {
  // An orphan history keeps checkpoints out of the deploy branch and preserves them beyond artifact retention.
  const snapshot = JSON.stringify({ version: 1, release, complete, urls: Object.fromEntries([...previous].sort()) }, null, 2) + '\n';
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
  const release = await waitForLiveRelease(expected);
  if (!release) return;
  const { previous, completedRelease, parent: stateParent } = checkpoint();
  if (completedRelease === release) {
    console.log(`Production ${release} has already been reconciled.`);
    return;
  }
  const current = parseManifest(verifiedManifest(release));
  let parent = stateParent;
  const { added, modified, removed } = changesSince(previous, current);
  console.log(`Production ${release}: ${added.length} added, ${modified.length} modified, ${removed.length} removed.`);
  const changed = [...added, ...modified, ...removed];
  if (!changed.length) {
    saveCheckpoint(release, previous, parent, true);
    return;
  }

  await verifyKey(key);
  for (let offset = 0; offset < changed.length; offset += batchSize) {
    const batch = changed.slice(offset, offset + batchSize);
    await submitBatch(key, batch, {
      beforeSend: async () => {
        if (await liveRelease() !== release) throw new Error('Production changed before submission. The next workflow will reconcile the new release.');
      },
    });
    for (const url of batch) {
      if (current.has(url)) previous.set(url, current.get(url));
      else previous.delete(url);
    }
    parent = saveCheckpoint(release, previous, parent, offset + batch.length === changed.length);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch(error => {
    console.error(`IndexNow: ${error.message}`);
    process.exitCode = 1;
  });
}
