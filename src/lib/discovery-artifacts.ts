import { createHash } from 'node:crypto';
import { person, site } from '../data/public.ts';
import { absolute, discovery } from '../config/discovery.ts';
import { mcpService } from '../config/mcp.ts';
import { a2a } from '../config/a2a.ts';
import { webmcpManifest } from '../config/webmcp.ts';
import { catalogue } from './catalogue.ts';
import { catalogueSchemas, jsonSchema } from './catalogue-schema.ts';
import { mcpTools, resourcePath, resourceUri, resources } from './mcp-surface.ts';

export type Artifact = { path: string; type: string; body: string };
const json = (path: string, type: string, value: unknown): Artifact => ({ path, type, body: JSON.stringify(value, null, 2) + '\n' });
const jsonType = 'application/json';
const publisher = new URL(site).hostname;
const identifier = (space: string, id: string) => `urn:air:${publisher}:${space}:${id}`;

export function discoveryArtifacts() {
  const keys = new Set(resources.map(item => item.key));
  for (const [key, snapshot] of Object.entries(catalogue)) {
    if (!keys.has(key as keyof typeof catalogue)) throw new Error(`Missing public registry for ${key}`);
    const result = catalogueSchemas[key as keyof typeof catalogue].safeParse(snapshot);
    if (!result.success) throw new Error(`Invalid public API data at ${key}: ${result.error.message}`);
  }
  const schemas = Object.fromEntries(resources.map(({ key }) => [key, jsonSchema(catalogueSchemas[key], { io: 'output' })]));
  const jsonDescription = (title: string) => `Retrieve ${title.toLowerCase()} in JSON.`;
  const apiOperations = resources.map(resource => ({
    path: resourcePath(resource.key), id: resource.tool + '_json', title: resource.title,
    description: jsonDescription(resource.title), schema: { $ref: `#/components/schemas/${resource.key}` },
  }));
  const cataloguePath = '/mcp-data.json';
  const openapi = {
    openapi: '3.1.1',
    info: { title: `${person.name} public portfolio API`, version: '1.0.0', description: 'Read-only professional catalogue. Public reads require no credentials.' },
    servers: [{ url: site }],
    security: [],
    paths: Object.fromEntries([...apiOperations, {
      path: cataloguePath, id: 'get_catalogue_json', title: 'Complete public catalogue', description: 'Read the combined public JSON snapshot.',
      schema: { type: 'object', additionalProperties: false, required: [...keys], properties: Object.fromEntries(apiOperations.map(({ path, schema }) => [path.slice(1, -5), schema])) },
    }].map(operation => [operation.path, { get: {
      operationId: operation.id, summary: operation.title, description: operation.description,
      responses: { '200': { description: 'Public JSON data', content: { [jsonType]: { schema: operation.schema } } } },
    } }])),
    components: { schemas },
  };
  const serviceDesc = { href: absolute(discovery.openapi.path), type: discovery.openapi.type };
  const guide = { href: absolute(discovery.integrationGuide.path), type: discovery.integrationGuide.type };
  const serviceMeta = { href: absolute(mcpService.cardPath), type: mcpService.cardType };
  const a2aMeta = { href: absolute(a2a.cardPath), type: a2a.cardType };
  const apiCatalog = { linkset: [
    { anchor: absolute(discovery.apiCatalog.path), item: [...apiOperations.map(operation => ({ href: absolute(operation.path), type: jsonType, title: operation.title })),
      { href: absolute(cataloguePath), type: jsonType }, { href: mcpService.url, title: 'Model Context Protocol' },
      { href: absolute(a2a.sendPath), title: a2a.name }] },
    ...[...apiOperations.map(operation => operation.path), cataloguePath].map(path => ({
      anchor: absolute(path), 'service-desc': [serviceDesc], 'service-doc': [guide],
    })),
    { anchor: mcpService.url, 'service-meta': [serviceMeta], 'service-doc': [guide] },
    { anchor: absolute(a2a.sendPath), 'service-meta': [a2aMeta], 'service-doc': [guide] },
  ] };
  const card = {
    $schema: mcpService.cardSchema,
    ...mcpService.identity,
    description: mcpService.description,
    remotes: [{ type: mcpService.transport, url: mcpService.url, supportedProtocolVersions: mcpService.protocolVersions }],
  };
  const mcpEntry = { identifier: identifier('server', 'professional-profile'), type: mcpService.cardType, url: serviceMeta.href };
  const a2aEntry = { identifier: identifier('agent', 'portfolio-assistant'), type: a2a.describeType, url: a2aMeta.href };
  const agentCard = {
    name: a2a.name, description: a2a.description, version: a2a.version, documentationUrl: guide.href,
    supportedInterfaces: [{ url: a2a.url, protocolBinding: a2a.protocolBinding, protocolVersion: a2a.protocolVersion }],
    capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
    defaultInputModes: ['text/plain'], defaultOutputModes: ['text/plain'],
    skills: resources.map(resource => ({
      id: resource.key, name: resource.title, description: `Retrieve ${resource.title.toLowerCase()} as standalone text.`, tags: [resource.key],
      examples: [resource.key, ...resource.queries],
    })),
  };
  const ard = { entries: [
    { ...mcpEntry, displayName: `${person.name} MCP server`, description: mcpService.description,
      version: mcpService.identity.version, capabilities: Object.keys(mcpTools),
      representativeQueries: [...resources[0].queries, resources[2].queries[0], resources[4].queries[0]] },
    { ...a2aEntry, displayName: a2a.name, description: a2a.description, version: a2a.version,
      capabilities: agentCard.skills.map(skill => skill.id), representativeQueries: [...resources[2].queries, ...resources[3].queries] },
    ...resources.map(resource => ({
      identifier: identifier('catalogue', resource.key), displayName: resource.title,
      description: jsonDescription(resource.title), type: jsonType, url: absolute(resourcePath(resource.key)),
      capabilities: [resource.key], representativeQueries: resource.queries,
    })),
  ] };
  const skillsBase = discovery.skills.path.slice(0, -'index.json'.length);
  const skills = resources.map(resource => {
    const name = resource.tool.replaceAll('_', '-');
    const description = mcpTools[resource.tool].description;
    const path = `${skillsBase}${name}/SKILL.md`;
    const body = [
      '---', `name: ${name}`, `description: ${JSON.stringify(description)}`, '---', '',
      `# ${resource.title}`, '', description, '',
      `1. Retrieve [${resource.title} JSON](${absolute(resourcePath(resource.key))}) over HTTPS. The endpoint accepts public reads without credentials.`,
      `2. With an MCP client, connect to ${mcpService.url} over Streamable HTTP. Call \`${resource.tool}\` with the advertised input schema or read \`${resourceUri(resource.id)}\`.`,
      '3. Cite the original source URLs attached to each record. Preserve stated publication and project statuses.', '',
      `See the [API catalog](${absolute(discovery.apiCatalog.path)}) and [MCP integration guide](${guide.href}) for other formats.`, '',
    ].join('\n');
    return {
      entry: { name, description, type: 'skill-md', url: path, digest: 'sha256:' + createHash('sha256').update(body).digest('hex') },
      artifact: { path, body, type: 'text/markdown; charset=utf-8' },
    };
  });
  return [
    json(discovery.ard.path, discovery.ard.type, ard),
    json(discovery.apiCatalog.path, discovery.apiCatalog.type + '; profile="https://www.rfc-editor.org/info/rfc9727"', apiCatalog),
    json(discovery.aiCatalog.path, discovery.aiCatalog.type, { specVersion: '1.0', entries: [mcpEntry] }),
    json(discovery.openapi.path, discovery.openapi.type, openapi),
    json(mcpService.cardPath, mcpService.cardType, card),
    json(a2a.cardPath, a2a.cardType, agentCard),
    json(discovery.skills.path, discovery.skills.type, { $schema: discovery.skillsSchema, skills: skills.map(skill => skill.entry) }),
    json(discovery.webmcp.path, discovery.webmcp.type, webmcpManifest()),
    ...skills.map(skill => skill.artifact),
  ];
}
