import assert from 'node:assert/strict';
import { a2a } from '../src/config/a2a.ts';
import { absolute, discovery } from '../src/config/discovery.ts';
import { mcpService } from '../src/config/mcp.ts';

const domain = new URL(absolute('/')).hostname;
const fqdn = domain + '.';
const describe = (path, prefix) => {
  const url = new URL(absolute(path));
  assert.equal(url.hostname, domain);
  return `${prefix}=${url.href}`;
};
const mcp = ['proto=mcp', 'path=' + mcpService.path, describe(mcpService.cardPath, 'desc-ref')];
const agent = ['proto=a2a', 'proto-ver=' + a2a.protocolVersion, 'path=' + a2a.path, describe(a2a.cardPath, 'desc-ref')];
const rdata = fields => fields.map(field => {
  assert.match(field, /^[a-z-]+=[\x21-\x7e]+$/);
  assert.ok(!/["\\]/.test(field) && Buffer.byteLength(field) <= 255, field);
  return `"${field}"`;
}).join(' ');

console.log(`; DNS-AID draft-mozleywilliams-dawn-dnsaid-00, section 4. Proposed records only.
; Keep the existing DNSSEC-validated SVCB index and all existing apex records.
_index._agents.${fqdn} 300 IN SVCB 1 ${fqdn} alpn=h2 port=443
; The ARD manifest currently lives at ${absolute(discovery.ard.path)}.
; Optional known-agent TXT fallbacks appended as distinct records at the apex.
${fqdn} 300 IN TXT ${rdata(mcp)}
${fqdn} 300 IN TXT ${rdata(agent)}`);
