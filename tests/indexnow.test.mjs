import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { changesSince, parseManifest, submitBatch } from '../scripts/indexnow.mjs';
import { site } from '../src/config/site.ts';

const release = 'a'.repeat(40);
const original = '1'.repeat(64);
const changed = '2'.repeat(64);
const oldUrl = site + '/old/';
const addedUrl = site + '/new/';
const editedUrl = site + '/edited/';
const keptUrl = site + '/kept/';
const manifest = (urls, revision = release) => ({ version: 1, release: revision, urls });
const key = 'test-indexnow-key';

test('IndexNow detects added, modified, removed, and unchanged canonical URLs', () => {
  const previous = parseManifest(manifest({ [oldUrl]: original, [editedUrl]: original, [keptUrl]: original }));
  const current = parseManifest(manifest({ [addedUrl]: original, [editedUrl]: changed, [keptUrl]: original }));
  assert.deepEqual(changesSince(previous, current), { added: [addedUrl], modified: [editedUrl], removed: [oldUrl] });
  assert.deepEqual(changesSince(current, current), { added: [], modified: [], removed: [] });
});

test('IndexNow refuses noncanonical, foreign, empty, and malformed production manifests', () => {
  for (const url of [site + '/new', addedUrl + '?x=1', addedUrl + '#x', 'https://example.com/new/', site + ':443/new/']) {
    assert.throws(() => parseManifest(manifest({ [url]: original })), /Invalid canonical/);
  }
  assert.throws(() => parseManifest(manifest({ [addedUrl]: 'invalid' })), /Invalid canonical/);
  assert.throws(() => parseManifest(manifest({})), /empty/);
  assert.throws(() => parseManifest(manifest({ [addedUrl]: original }, 'local')), /Invalid IndexNow manifest/);
});

test('IndexNow respects Retry-After, retries network and server errors, and accepts HTTP 202', async () => {
  const responses = [null, new Response(null, { status: 429, headers: { 'Retry-After': '3' } }), new Response(null, { status: 503 }), new Response(null, { status: 202 })];
  const waits = [];
  let attempts = 0;
  await submitBatch(key, [oldUrl, addedUrl], {
    send: async (endpoint, options) => {
      assert.equal(endpoint, 'https://api.indexnow.org/indexnow');
      assert.deepEqual(JSON.parse(options.body), {
        host: new URL(site).hostname, key, keyLocation: site + '/' + key + '.txt', urlList: [oldUrl, addedUrl],
      });
      const response = responses[attempts++];
      if (!response) throw new Error('Test network failure');
      return response;
    },
    wait: async ms => { waits.push(ms); },
  });
  assert.equal(attempts, 4);
  assert.deepEqual(waits, [1000, 3000, 4000]);

  await assert.rejects(submitBatch(key, [addedUrl], {
    send: async () => new Response(null, { status: 403 }),
    wait: async () => assert.fail('HTTP 403 must not be retried'),
  }), /HTTP 403/);
  await assert.rejects(submitBatch(key, [addedUrl], {
    send: async () => assert.fail('Must not send after the release changes'),
    beforeSend: async () => { throw new Error('Production changed'); },
  }), /Production changed/);
});

test('IndexNow checkpoints a successful release and reconciles changes once', t => {
  const dir = mkdtempSync(join(tmpdir(), 'portfolio-indexnow-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '--bare', 'remote.git');
  git('init', '-b', 'main');
  git('remote', 'add', 'origin', './remote.git');

  const gh = join(dir, 'gh');
  writeFileSync(gh, `#!/usr/bin/env node
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const args = process.argv.slice(2);
if (args[0] === 'api') {
  const head_sha = args.find(arg => arg.startsWith('head_sha=')).slice(9);
  console.log(JSON.stringify({ workflow_runs: [
    { id: 1, head_sha, head_branch: 'main', head_repository: { full_name: 'another/repo' }, event: 'push' },
    { id: 2, head_sha, head_branch: 'main', head_repository: { full_name: process.env.GITHUB_REPOSITORY }, event: 'push' },
  ] }));
} else if (args[0] === 'run' && args[1] === 'download' && args[2] === '2' && args.includes('indexnow-manifest')) {
  writeFileSync(join(args.at(-1), 'indexnow-manifest.json'), process.env.TEST_INDEXNOW_MANIFEST);
} else {
  process.exitCode = 1;
}
`, { mode: 0o755 });

  const fixture = join(dir, 'mock.mjs');
  writeFileSync(fixture, `
import { appendFileSync } from 'node:fs';
const commit = process.env.TEST_INDEXNOW_LIVE_RELEASE;
globalThis.fetch = async (url, options) => {
  if (String(url) === 'https://api.indexnow.org/indexnow') {
    if (process.env.TEST_INDEXNOW_REJECT === '1') return new Response(null, { status: 403 });
    appendFileSync('submissions.jsonl', JSON.stringify(JSON.parse(options.body).urlList) + '\\n');
    return new Response(null, { status: 202 });
  }
  const { pathname } = new URL(url);
  if (pathname === '/deployment-version.txt') return new Response(commit + '\\n');
  if (pathname === '/${key}.txt') return new Response('${key}');
  throw new Error('Unexpected URL: ' + url);
};
`);
  const script = fileURLToPath(new URL('../scripts/indexnow.mjs', import.meta.url));
  const { INDEXNOW_DEPLOY_SHA, ...env } = process.env;
  const run = (value, { reject = false, liveRelease = value.release } = {}) => spawnSync(process.execPath, ['--import', fixture, script], {
    cwd: dir, encoding: 'utf8',
    env: {
      ...env,
      PATH: dir + ':' + env.PATH,
      GITHUB_REPOSITORY: 'test/site',
      INDEXNOW_PRODUCTION_BRANCH: 'main',
      INDEXNOW_KEY: key,
      TEST_INDEXNOW_MANIFEST: JSON.stringify(value),
      TEST_INDEXNOW_LIVE_RELEASE: liveRelease,
      TEST_INDEXNOW_REJECT: reject ? '1' : '0',
    },
  });
  const ok = value => {
    const result = run(value);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  const snapshot = () => git('--git-dir', './remote.git', 'show', 'refs/heads/indexnow-state:manifest.json');
  const baseline = manifest({ [oldUrl]: original, [editedUrl]: original, [keptUrl]: original });
  assert.match(ok(baseline), /3 added, 0 modified, 0 removed/);
  assert.deepEqual(JSON.parse(snapshot()), { ...baseline, complete: true });
  const next = manifest({ [addedUrl]: original, [editedUrl]: changed, [keptUrl]: original }, 'b'.repeat(40));
  const mismatch = run(baseline, { liveRelease: next.release });
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /verified manifest does not match/);
  const failed = run(next, { reject: true });
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /HTTP 403/);
  assert.deepEqual(JSON.parse(snapshot()), { ...baseline, complete: true });
  assert.match(ok(next), /1 added, 1 modified, 1 removed/);
  assert.deepEqual(JSON.parse(snapshot()), { ...next, complete: true });
  assert.match(ok(next), /has already been reconciled/);

  const submissions = readFileSync(join(dir, 'submissions.jsonl'), 'utf8');
  assert.deepEqual(submissions.trim().split('\n').map(JSON.parse), [
    [oldUrl, editedUrl, keptUrl], [addedUrl, editedUrl, oldUrl],
  ]);
});
