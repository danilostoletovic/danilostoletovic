import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const dist = resolve('dist');
const snapshot = async () => {
  const files = (await readdir(dist, { recursive: true, withFileTypes: true }))
    .filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name)).sort();
  assert.ok(files.length, 'Build the site before checking reproducibility.');
  return Object.fromEntries(await Promise.all(files.map(async path => [
    relative(dist, path), createHash('sha256').update(await readFile(path)).digest('hex'),
  ])));
};

const first = await snapshot();
const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], { stdio: 'inherit' });
assert.equal(result.status, 0, result.error?.message ?? 'Clean rebuild failed');
const second = await snapshot();
const changed = [...new Set([...Object.keys(first), ...Object.keys(second)])].filter(path => first[path] !== second[path]);
assert.deepEqual(changed, [], 'Differences between clean builds');
console.log(`Two clean builds produced identical bytes for ${Object.keys(first).length} files.`);
