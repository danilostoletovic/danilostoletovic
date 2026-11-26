import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const origin = process.env.VERIFY_URL || 'http://127.0.0.1:8787';
const url = new URL('/mcp', origin);
const fetchFile = async name => {
  const response = await fetch(new URL(name, origin));
  assert.equal(response.status, 200, name);
  return response;
};

test('official MCP client discovers and uses the public catalogue', async t => {
  const client = new Client({ name: 'professional-site-check', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  const transport = new StreamableHTTPClientTransport(url);
  t.after(() => client.close());
  await client.connect(transport);
  assert.equal(client.getProtocolEra(), 'modern');
  assert.equal(client.getNegotiatedProtocolVersion(), '2026-07-28');
  assert.equal(client.getServerVersion().name, 'danilo-professional-profile');
  assert.ok(client.getServerCapabilities().tools);
  assert.ok(client.getServerCapabilities().resources);

  const snapshot = await (await fetchFile('/mcp-data.json')).json();
  const { tools } = await client.listTools();
  const { resources } = await client.listResources();
  assert.equal(tools.length, 13);
  assert.equal(resources.length, 10);
  assert.ok(tools.every(tool => tool.annotations.readOnlyHint && tool.annotations.destructiveHint === false));
  const collections = {
    professional: 'profile', experience: 'experience', services: 'services', projects: 'projects',
    publications: 'publications', 'case-studies': 'case-studies', achievements: 'achievements',
    news: 'news', links: 'links', contact: 'contact',
  };
  for (const item of resources) {
    const { contents } = await client.readResource({ uri: item.uri });
    assert.equal(contents[0].mimeType, 'application/json');
    assert.deepEqual(JSON.parse(contents[0].text), snapshot[collections[item.uri.replace('profile://', '')]]);
  }

  const call = (name, args = {}) => client.callTool({ name, arguments: args });
  assert.deepEqual((await call('get_profile')).structuredContent, snapshot.profile);
  assert.deepEqual((await call('get_experience')).structuredContent.items, snapshot.experience);
  assert.deepEqual((await call('get_contact')).structuredContent, snapshot.contact);
  for (const [name, key] of [
    ['list_services', 'services'], ['list_projects', 'projects'], ['list_case_studies', 'case-studies'],
    ['list_publications', 'publications'], ['list_achievements', 'achievements'], ['list_news', 'news'], ['list_profiles', 'links'],
  ]) {
    const result = (await call(name)).structuredContent;
    assert.deepEqual(result, { items: snapshot[key].slice(0, 20), total: snapshot[key].length }, name);
  }
  assert.equal((await call('get_project', { id: 'smart-vehicle' })).structuredContent.item.title, 'SmartVehicle');
  assert.equal((await call('get_case_study', { id: 'secretary' })).structuredContent.item.project, 'secretary');
  const paper = snapshot.publications.find(work => work.project === 'smart-vehicle' && work.status === 'Published');
  assert.ok(paper?.doi);
  assert.ok((await call('list_publications', { status: 'Published' })).structuredContent.items.some(work => work.doi === paper.doi));
  assert.equal((await call('search_content', { query: paper.doi })).structuredContent.items[0].url, paper.url);
  assert.equal((await call('list_projects', { category: 'Apps', limit: 1 })).structuredContent.items[0].category, 'Apps');
  assert.ok((await call('list_profiles', { identity: 'project' })).structuredContent.items.every(item => item.identity === 'project'));
  assert.equal((await call('search_content', { query: 'SMARTVEHICLE', limit: 1 })).structuredContent.items[0].id, 'smart-vehicle');
  assert.deepEqual((await call('search_content', { query: 'no-such-public-entry' })).structuredContent.items, []);
  assert.equal((await call('get_project', { id: 'unlisted-project' })).isError, true);
  for (const [name, args] of [
    ['list_projects', { limit: 99 }], ['search_content', { query: 'x' }], ['get_project', { id: '../private' }],
    ['get_contact', { url: 'https://example.com' }], ['delete_profile', {}],
  ]) {
    const result = await call(name, args).catch(error => error);
    assert.ok(result instanceof Error || result.isError === true, name);
  }
  await assert.rejects(client.readResource({ uri: 'file:///internal.txt' }));
  const exposed = JSON.stringify(snapshot);
  assert.doesNotMatch(exposed, /OPENAI_API_KEY|internal research|wa\.me|testimonial-samples/);
});

test('legacy handshake, validation, CORS, and response cache policy', async () => {
  const base = {
    'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
  };
  const post = (body, headers = {}) => fetch(url, { method: 'POST', headers: { ...base, ...headers }, body });
  const initialize = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'legacy-check', version: '1.0.0' } },
  });
  const legacy = await post(initialize);
  assert.equal(legacy.status, 200);
  assert.equal(legacy.headers.get('cache-control'), 'no-store, no-transform');
  const body = await legacy.text();
  const handshake = JSON.parse(body.startsWith('{') ? body : body.split('\n').find(line => line.startsWith('data:')).slice(5));
  assert.equal(handshake.result.protocolVersion, '2025-11-25');
  assert.ok(handshake.result.capabilities.tools);
  assert.equal((await post(initialize, { Origin: 'https://untrusted.example' })).status, 403);
  const cors = await fetch(url, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } });
  assert.equal(cors.status, 204);
  assert.equal(cors.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal((await post('x'.repeat(17_000))).status, 413);
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(17_000)); controller.close(); } });
  const oversizedStream = await fetch(url, { method: 'POST', headers: base, body: stream, duplex: 'half' });
  assert.equal(oversizedStream.status, 413);
  const invalidJson = await post('{');
  assert.equal(invalidJson.status, 400);
  assert.equal((await fetch(url, { method: 'PUT' })).status, 405);
});
