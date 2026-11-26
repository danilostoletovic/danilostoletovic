import { readFile } from 'node:fs/promises';

const snapshot = JSON.parse(await readFile(new URL('../dist/mcp-data.json', import.meta.url), 'utf8'));
const urls = new Set();
const pendingDois = new Set(snapshot.publications.filter(work => work.doiRegistration === 'pending').map(work => work.doiUrl));
function collect(value) {
  if (typeof value === 'string' && value.startsWith('https://')) {
    const url = new URL(value);
    if (url.hostname !== 'danilostoletovic.com') urls.add(url.href);
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) collect(child);
  }
}
collect(snapshot);

async function probe(url) {
  const get = method => fetch(url, { method, signal: AbortSignal.timeout(8_000) });
  try {
    let result = await get('HEAD');
    await result.body?.cancel();
    if ([403, 404, 405, 501].includes(result.status)) {
      result = await get('GET');
      await result.body?.cancel();
    }
    const status = result.status;
    const kind = result.ok ? 'reachable'
      : status === 404 || status === 410 ? (pendingDois.has(url) ? 'DOI registration pending' : 'missing')
      : status === 401 || status === 403 || status === 999 ? 'authentication or bot protection'
      : status === 429 || (status >= 500 && status <= 599) ? 'temporary or rate limited'
      : 'review';
    return { url, status, kind, ...(result.redirected ? { finalUrl: result.url } : {}) };
  } catch {
    return { url, status: null, kind: 'network or timeout' };
  }
}

const pending = [...urls].sort();
const results = [];
await Promise.all(Array.from({ length: 5 }, async () => {
  while (pending.length) {
    const next = pending.shift();
    results.push(await probe(next));
  }
}));
results.sort((a, b) => a.url.localeCompare(b.url));
for (const result of results) console.log(JSON.stringify(result));
if (results.some(result => result.kind === 'missing')) process.exitCode = 1;
