import assert from 'node:assert/strict';
import { test } from 'node:test';
import { a2a } from '../src/config/a2a.ts';
import { contentSignal, discovery } from '../src/config/discovery.ts';
import { markdownPath } from '../src/config/markdown.ts';
import { securityHeaders, analytics, ana } from '../src/config/security.ts';
import { mcpService } from '../src/config/mcp.ts';

const origin = process.env.VERIFY_URL || 'http://127.0.0.1:8787';
const get = (path, options) => fetch(new URL(path, origin), { redirect: 'manual', ...options });
const accept = (value, method) => ({ method, headers: { Accept: value } });

test('negotiation serves the prebuilt file and keeps HTML and Markdown cache keys apart', async () => {
  for (const path of ['/', '/commerce/', '/side-projects/smart-vehicle/', '/academia/smartvehicle-ieeestec-2026/']) {
    const md = await get(path, accept('text/markdown'));
    assert.equal(md.status, 200, path);
    assert.match(md.headers.get('Content-Type'), /^text\/markdown\b/);
    assert.match(md.headers.get('Cache-Control'), /no-store/);
    assert.match(md.headers.get('Vary'), /Accept/i);
    assert.match(md.headers.get('Link'), /rel="canonical"/);
    const canonical = md.headers.get('Link').match(/<([^>]+)>/)[1];
    assert.equal(new URL(canonical).pathname, path);
    const body = await md.text();
    assert.match(body, /^# /);
    const file = await get(markdownPath(path));
    assert.equal(file.status, 200);
    assert.equal(await file.text(), body);
    assert.match(file.headers.get('Cache-Control'), /must-revalidate/);
    const html = await get(path, accept('text/html'));
    assert.match(html.headers.get('Content-Type'), /^text\/html/);
    assert.match(html.headers.get('Vary'), /Accept/i);
    assert.match(html.headers.get('Link'), /type="text\/markdown"/);
    assert.match(html.headers.get('Cache-Control'), /no-transform/);
    assert.notEqual(html.headers.get('ETag'), md.headers.get('ETag'));
    const head = await get(path, accept('text/markdown', 'HEAD'));
    assert.match(head.headers.get('Content-Type'), /^text\/markdown/);
    assert.equal(await head.text(), '');
  }
  for (const value of ['*/*', 'text/*', 'text/markdown;q=0, */*', 'text/markdown;q=0.5, text/html', 'text/html, text/markdown']) {
    assert.match((await get('/', accept(value))).headers.get('Content-Type'), /^text\/html/, value);
  }
  for (const value of ['text/markdown, */*', 'text/markdown; charset="utf-8";q=1, text/html;q=0.8', 'text/html;q=0, text/*']) {
    assert.match((await get('/', accept(value))).headers.get('Content-Type'), /^text\/markdown/, value);
  }
  assert.equal((await get('/', accept('text/markdown;q=0, text/html;q=0'))).status, 406);
  assert.equal((await get('/commerce/does-not-exist/', accept('text/markdown'))).status, 404);
});

test('HTTP discovery, content preferences and CSP are applied by Workers Assets', async () => {
  const root = await get('/');
  const csp = root.headers.get('Content-Security-Policy');
  assert.match(csp, /^default-src 'none'; /);
  const connections = csp.match(/connect-src ([^;]+)/)[1].split(' ');
  assert.deepEqual(connections, ["'self'", analytics.collector, new URL(ana.endpoint).origin]);
  assert.ok(csp.includes(securityHeaders('test')['Content-Security-Policy'].split(' connect-src ')[1]));
  assert.ok(root.headers.get('Link').includes('rel="api-catalog"'));
  assert.ok(root.headers.get('Link').includes('rel="ard"'));
  assert.ok((await get(discovery.integrationGuide.path)).headers.get('Link').includes('rel="service-meta"'));
  assert.equal(root.headers.get('Content-Signal'), contentSignal);
  const robots = await get('/robots.txt').then(response => response.text());
  assert.ok(robots.includes('Content-Signal: ' + contentSignal));
  assert.ok(robots.includes('Sitemap: ') && robots.includes(discovery.sitemap));
  for (const item of [discovery.ard, discovery.apiCatalog, discovery.openapi, discovery.skills, discovery.webmcp, discovery.aiCatalog]) {
    const response = await get(item.path);
    assert.equal(response.status, 200, item.path);
    assert.equal(response.headers.get('Content-Type').split(';', 1)[0], item.type);
    assert.equal(typeof (await response.json()), 'object');
  }
  for (const [path, media] of [[mcpService.cardPath, mcpService.cardType], [a2a.cardPath, a2a.cardType]]) {
    const response = await get(path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), media);
  }
});

test('the advertised A2A binding serves public data and enforces boundaries', async () => {
  const card = await (await get(a2a.cardPath)).json();
  assert.equal(card.supportedInterfaces[0].url, a2a.url);
  assert.deepEqual(card.capabilities, { streaming: false, pushNotifications: false, extendedAgentCard: false });
  const post = (input, extraHeaders = {}) => get(a2a.sendPath, {
    method: 'POST', body: typeof input === 'string' ? input : JSON.stringify(input),
    headers: { 'Content-Type': a2a.messageType, 'A2A-Version': a2a.protocolVersion, ...extraHeaders },
  });
  const message = text => ({ message: { messageId: 'sample', role: 'ROLE_USER', parts: [{ text }] } });
  const response = await post(message('projects: SmartVehicle'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), a2a.messageType);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const result = (await response.json()).message;
  assert.equal(result.role, 'ROLE_AGENT');
  assert.match(result.parts[0].text, /SmartVehicle.+Raspberry Pi/i);
  assert.match(result.parts[0].text, /1 of 1/);
  const contact = await (await get('/contact.json')).json();
  const contactReply = await (await post(message('contact'))).json();
  assert.match(contactReply.message.parts[0].text, new RegExp(contact.email.replaceAll('.', '\\.')));
  assert.equal((await post(message('contact'), { Origin: 'https://untrusted.example' })).status, 403);
  const badVersion = await post(message('contact'), { 'A2A-Version': '0.3' });
  assert.equal(badVersion.status, 400);
  assert.deepEqual((await badVersion.json()).supportedVersions, [a2a.protocolVersion]);
  assert.equal((await post({ message: { messageId: '1', role: 'ROLE_USER', parts: [{ raw: 'aGVsbG8=' }] } })).status, 400);
  assert.equal((await post('x'.repeat(a2a.maxBody + 1))).status, 413);
  assert.equal((await post(message('contact'), { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await get(a2a.path + '/tasks/missing', { headers: { 'A2A-Version': a2a.protocolVersion } })).status, 404);
});

test('the local A2A limiter enforces the configured per-IP request budget', {
  skip: !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname),
}, async () => {
  const ip = '2001:db8::' + crypto.randomUUID().slice(0, 4);
  const headers = {
    'A2A-Version': a2a.protocolVersion,
    'CF-Connecting-IP': ip,
  };
  for (let count = 0; count < 30; count++) {
    const accepted = await get(a2a.path + '/tasks', { headers });
    assert.equal(accepted.status, 200);
    await accepted.arrayBuffer();
  }
  const limited = await get(a2a.path + '/tasks', { headers });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
});
