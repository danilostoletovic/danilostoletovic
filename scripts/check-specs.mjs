import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const published = [
  ['ARD', 'ard-entry.schema.json', 'https://raw.githubusercontent.com/ards-project/ard-spec/main/spec/schemas/ard-entry.schema.json'],
  ['MCP Server Card', 'mcp-server-card.schema.json', 'https://raw.githubusercontent.com/modelcontextprotocol/ext-server-card/main/schema.json'],
  ['OpenAPI', 'openapi.schema.json', 'https://spec.openapis.org/oas/3.1/schema/2025-09-15'],
  ['Agent Skills Discovery', null, 'https://raw.githubusercontent.com/cloudflare/agent-skills-discovery-rfc/main/README.md'],
  ['A2A', null, 'https://a2a-protocol.org/v1.0.1/specification/'],
  ['WebMCP', null, 'https://webmachinelearning.github.io/webmcp/'],
  ['DNS-AID', null, 'https://datatracker.ietf.org/doc/html/draft-mozleywilliams-dawn-dnsaid'],
];
const sha = data => createHash('sha256').update(data).digest('hex');
let failures = 0;
for (const [name, filename, url] of published) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (filename) {
      const local = await readFile(new URL(`schemas/${filename}`, import.meta.url), 'utf8');
      const upstream = await response.text();
      const digest = document => sha(JSON.stringify(JSON.parse(document)));
      const current = digest(local) === digest(upstream);
      console.log(`${name}: ${current ? 'pinned schema matches' : 'upstream schema differs; review the diff before updating'}`);
      if (!current) failures++;
    } else {
      console.log(`${name}: reference reachable (${response.status})`);
    }
  } catch (error) {
    failures++;
    console.error(`${name}: ${error.message}`);
  }
}
if (process.argv.includes('--links')) {
  const checked = spawnSync(process.execPath, ['scripts/check-links.mjs'], { stdio: 'inherit' });
  if (checked.status !== 0) failures++;
}
process.exitCode = failures ? 1 : 0;
