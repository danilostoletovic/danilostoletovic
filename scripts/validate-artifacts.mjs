import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { SaxesParser } from 'saxes';
import * as z from 'zod/v4';
import { a2a } from '../src/config/a2a.ts';
import { absolute, contentSignal, discovery, robotsText } from '../src/config/discovery.ts';
import { markdownPath } from '../src/config/markdown.ts';
import { mcpService } from '../src/config/mcp.ts';
import { analytics } from '../src/config/security.ts';
import { deploymentVersionPath, indexNowKey, indexNowKeyPath, indexNowManifestPath } from '../src/config/indexnow.ts';
import { person } from '../src/data/public.ts';
import { pageMarkdown } from '../src/lib/artifacts.ts';
import { discoveryArtifacts } from '../src/lib/discovery-artifacts.ts';
import { resources, resourcePath } from '../src/lib/mcp-surface.ts';

const root = resolve(process.argv[2] ?? 'dist');
const read = path => readFile(resolve(root, '.' + path), 'utf8');
const json = async path => JSON.parse(await read(path));
const schema = async name => JSON.parse(await readFile(new URL(`schemas/${name}.schema.json`, import.meta.url), 'utf8'));
const ajv = addFormats(new Ajv2020({ strict: false, allErrors: true }));
ajv.addFormat('media-range', /^(?:\*|[\w!#$&^.+-]+)\/(?:\*|[\w!#$&^.+-]+)(?:\s*;.*)?$/);
const validate = (contract, data, label) => {
  const check = ajv.compile(contract);
  assert.ok(check(data), `${label}: ${ajv.errorsText(check.errors, { separator: '\n' })}`);
};
const xml = (source, rootName) => {
  const parser = new SaxesParser({ xmlns: true });
  let root;
  parser.on('doctype', () => assert.fail('Unexpected XML doctype'));
  parser.on('opentag', node => { root ??= node; });
  parser.write(source).close();
  assert.equal(root?.name, rootName);
  return root;
};

const artifacts = discoveryArtifacts();
assert.equal(new Set(artifacts.map(file => file.path)).size, artifacts.length, 'Artifact path collision');
for (const artifact of artifacts) assert.equal(await read(artifact.path), artifact.body, `Stale file ${artifact.path}`);
assert.equal(await read('/robots.txt'), robotsText());
const key = indexNowKey();
if (key) assert.equal(await read(indexNowKeyPath(key)), key, 'IndexNow verification body');
const indexNowManifest = await json(indexNowManifestPath);
assert.equal(indexNowManifest.version, 1);
assert.equal(indexNowManifest.release, (await read(deploymentVersionPath)).trim());

const sitemap = await read(discovery.sitemap);
const sitemapRoot = xml(sitemap, 'urlset');
assert.equal(sitemapRoot.uri, 'http://www.sitemaps.org/schemas/sitemap/0.9');
assert.equal(sitemapRoot.ns.image, 'http://www.google.com/schemas/sitemap-image/1.1');
assert.ok(sitemap.includes(`<loc>${absolute('/')}</loc><image:image><image:loc>${person.image.url}</image:loc></image:image>`));
assert.equal(xml(await read('/rss.xml'), 'rss').attributes.version.value, '2.0');
const pages = pageMarkdown();
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
assert.deepEqual(new Set(locations), new Set([...pages.keys()].map(absolute)));
assert.equal(new Set(locations).size, locations.length);
assert.deepEqual(Object.keys(indexNowManifest.urls).sort(), locations.toSorted());
const headers = await read('/_headers');
assert.match(headers, /script-src 'self' 'sha256-[-A-Za-z0-9+/=]+'/);
assert.ok(headers.includes(`Content-Signal: ${contentSignal}`));
assert.ok(headers.match(/connect-src ([^\n;]*)/)?.[1].split(' ').includes(analytics.collector));
assert.ok(!headers.includes('api-gateway.umami.dev'));
for (const [path, body] of pages) {
  const format = markdownPath(path);
  assert.equal(await read(format), body, `Stale Markdown for ${path}`);
  const html = await read(path + 'index.html');
  const fingerprint = createHash('sha256').update(JSON.stringify([html, body])).digest('hex');
  assert.equal(indexNowManifest.urls[absolute(path)], fingerprint, `IndexNow fingerprint for ${path}`);
  assert.ok(html.includes(`rel="canonical" href="${absolute(path)}"`));
  assert.ok(html.includes(`rel="ard" type="${discovery.ard.type}" href="${discovery.ard.path}"`));
  const jsonLd = html.match(/<script type="application\/ld\+json">(.+?)<\/script>/);
  assert.ok(jsonLd, `Missing JSON-LD for ${path}`);
  const graph = JSON.parse(jsonLd[1])['@graph'];
  if (path !== '/') {
    const page = graph.find(node => node['@id'] === `${absolute(path)}#page`);
    const breadcrumbs = graph.find(node => node['@type'] === 'BreadcrumbList');
    assert.equal(breadcrumbs?.name, page.name, `Breadcrumb list name for ${path}`);
  }
  const identity = graph.find(node => node['@type'] === 'Person');
  const image = graph.find(node => node['@id'] === identity.image['@id']);
  assert.equal(image['@type'], 'ImageObject', path);
  assert.equal(image.contentUrl, person.image.url, path);
  assert.equal(image.encodingFormat, person.image.mimeType, path);
  assert.equal(image.width.value, person.image.width, path);
  assert.equal(image.height.value, person.image.height, path);
  assert.equal(image.about['@id'], identity['@id'], path);
}

const ard = await json(discovery.ard.path);
validate({ ...await schema('ard-entry'), $ref: '#/$defs/ArdManifest' }, ard, 'ARD');
const ardIds = new Set();
for (const entry of ard.entries) {
  assert.ok(!ardIds.has(entry.identifier), entry.identifier);
  ardIds.add(entry.identifier);
  assert.equal(entry.identifier.split(':')[2], new URL(absolute('/')).hostname);
  assert.ok(entry.representativeQueries.length >= 2 && entry.representativeQueries.length <= 5);
  await read(new URL(entry.url).pathname);
}
validate({ ...await schema('mcp-server-card'), $ref: '#/$defs/ServerCard' }, await json(mcpService.cardPath), 'MCP Server Card');

const link = z.object({ href: z.url(), type: z.string().optional() });
const linkset = z.object({ linkset: z.array(z.object({
  anchor: z.url(), item: z.array(link).optional(), 'service-meta': z.array(link).optional(),
  'service-desc': z.array(link).optional(), 'service-doc': z.array(link).optional(),
})).nonempty() });
linkset.parse(await json(discovery.apiCatalog.path));
const openapi = await json(discovery.openapi.path);
// The base OpenAPI schema's dynamic meta anchor can be overridden by a dialect.
// This document uses the base dialect, so resolve that anchor statically for Ajv.
const openapiContract = JSON.parse(JSON.stringify(await schema('openapi'))
  .replaceAll('"$dynamicRef":"#meta"', '"$ref":"#/$defs/schema"'));
validate(openapiContract, openapi, 'OpenAPI');
const combined = await json('/mcp-data.json');
for (const { key } of resources) {
  const body = await json(resourcePath(key));
  validate({ $defs: openapi.components.schemas, $ref: `#/$defs/${key}` }, body, resourcePath(key));
  assert.deepEqual(combined[key], body, `MCP snapshot mismatch for ${key}`);
}
const skills = z.object({ $schema: z.literal(discovery.skillsSchema), skills: z.array(z.object({
  name: z.string().max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().min(1).max(1024),
  type: z.literal('skill-md'), url: z.string().startsWith('/.well-known/agent-skills/'),
  digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
})).nonempty() }).parse(await json(discovery.skills.path));
assert.equal(new Set(skills.skills.map(skill => skill.name)).size, skills.skills.length);
for (const skill of skills.skills) {
  const body = await read(skill.url);
  assert.ok(body.startsWith(`---\nname: ${skill.name}\ndescription: ${JSON.stringify(skill.description)}\n---\n`));
  assert.equal('sha256:' + createHash('sha256').update(body).digest('hex'), skill.digest);
}

const browserTools = await json(discovery.webmcp.path);
const names = new Set(Object.values(browserTools.forms).map(form => form.name));
for (const tool of browserTools.tools) {
  assert.ok(!names.has(tool.name), tool.name);
  names.add(tool.name);
  assert.equal(tool.inputSchema.type, 'object');
  assert.equal(tool.inputSchema.additionalProperties, false);
  ajv.compile(tool.inputSchema);
  for (const property of Object.values(tool.inputSchema.properties)) {
    assert.ok(property.type === 'integer' || (property.type === 'string' && Array.isArray(property.enum)), `${tool.name} has an unsupported browser input field`);
  }
  if (tool.endpoint) await json(tool.endpoint);
}

const card = await json(a2a.cardPath);
z.object({
  name: z.string().min(1), description: z.string().min(1), version: z.string().min(1),
  supportedInterfaces: z.array(z.object({
    url: z.literal(a2a.url), protocolBinding: z.literal(a2a.protocolBinding), protocolVersion: z.literal(a2a.protocolVersion),
  })).length(1),
  capabilities: z.object({ streaming: z.literal(false), pushNotifications: z.literal(false), extendedAgentCard: z.literal(false) }),
  defaultInputModes: z.tuple([z.literal('text/plain')]), defaultOutputModes: z.tuple([z.literal('text/plain')]),
  skills: z.array(z.object({ name: z.string(), id: z.string(), description: z.string().min(1), tags: z.array(z.string()).min(1) })).nonempty(),
}).parse(card);
assert.deepEqual(card.skills.map(skill => skill.id), resources.map(item => item.key));

const credentialPattern = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\bsk-(?:proj-|ant-)?[\w-]{24,}\b|\bgh[pousr]_[A-Za-z0-9]{28,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b|\bAKIA[0-9A-Z]{16}\b|\bAIza[0-9A-Za-z_-]{35}\b|\beyJ[\w-]+\.eyJ[\w-]+\.[\w-]{20,}\b)/;
const textTypes = new Set(['', '.html', '.js', '.json', '.txt', '.xml', '.webmanifest', '.md', '.css', '.map', '.svg', '.bib', '.ris']);
for (const file of await readdir(root, { recursive: true, withFileTypes: true })) {
  if (!file.isFile() || !textTypes.has(extname(file.name))) continue;
  assert.ok(!credentialPattern.test(await readFile(join(file.parentPath, file.name), 'utf8')), `Possible credential in ${file.name}`);
}
console.log(`Validated ${artifacts.length} discovery files, ${pages.size} Markdown pages, OpenAPI payloads, XML, and public output.`);
