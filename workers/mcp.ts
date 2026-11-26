import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import type { RateLimit } from '@cloudflare/workers-types';
import * as z from 'zod/v4';
import { catalogue } from '../src/lib/catalogue';
import { resources, resourceUri, toolDescriptions } from '../src/lib/mcp-surface';
import { site } from '../src/data/public';

export interface McpEnv {
  MCP_RATE_LIMITER: RateLimit;
  MCP_ALLOWED_ORIGINS?: string;
}

const maxRequestBodySize = 16 * 1024;
const id = z.string().max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const limit = z.number().int().min(1).max(30).optional().default(20);
const empty = z.strictObject({});
const list = z.strictObject({ limit });
const byId = z.strictObject({ id });
const byProject = list.extend({ project: id.optional() });
const projectFilter = list.extend({
  category: z.enum(['Robotics', 'Apps', 'Web & AI', 'Systems']).optional(),
  status: z.enum(['Released', 'Open-source project', 'Alpha', 'Prototype', 'Experiment']).optional(),
});
const publicationFilter = list.extend({ status: z.enum(['Published', 'Submitted', 'In progress', 'Unpublished']).optional() });
const newsFilter = list.extend({ year: z.string().regex(/^\d{4}$/).optional() });
const profileFilter = list.extend({
  category: z.enum(['Professional', 'Open source', 'Research', 'Social', 'Distribution']).optional(),
  identity: z.enum(['personal', 'project']).optional(),
});
const searchInput = list.extend({ query: z.string().trim().min(2).max(100) });
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

function response(data: Record<string, unknown>, isError = false) {
  return { structuredContent: data, content: [{ type: 'text' as const, text: JSON.stringify(data) }], ...(isError && { isError: true }) };
}

function collection<T>(items: readonly T[], capacity: number) {
  return { items: items.slice(0, capacity), total: items.length };
}

function individual<T extends { id: string }>(items: readonly T[], key: string) {
  const item = items.find(item => item.id === key);
  return item ? response({ item }) : response({ error: 'No public entry with that identifier.' }, true);
}

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const searchGroups = {
  projects: catalogue.projects,
  'case-studies': catalogue['case-studies'],
  services: catalogue.services,
  publications: catalogue.publications,
  achievements: catalogue.achievements,
  news: catalogue.news,
  links: catalogue.links,
};
const searchIndex = Object.entries(searchGroups).flatMap(([kind, entries]) => entries.map(entry => {
  const url = 'url' in entry && entry.url
    ? entry.url
    : kind === 'services' ? `${site}/commerce/${entry.id}/` : `${site}/academia/#${entry.id}`;
  return {
    title: normalize(entry.title),
    text: normalize([
      entry.id, entry.title, entry.summary,
      'stack' in entry ? entry.stack.join(' ') : '',
      'authorDetails' in entry ? [entry.venue, entry.doi, entry.proceedings?.isbn, ...entry.authors].join(' ') : '',
    ].join(' ')),
    result: { kind, id: entry.id, title: entry.title, summary: entry.summary, url, sources: entry.sources },
  };
}));

function search(query: string, capacity: number) {
  const normalized = normalize(query);
  const words = normalized.split(/\s+/);
  const results = searchIndex
    .filter(entry => words.every(word => entry.text.includes(word)))
    .sort((a, b) => Number(b.title.includes(normalized)) - Number(a.title.includes(normalized)))
    .map(entry => entry.result);
  return collection(results, capacity);
}

const mcp = createMcpHandler(() => {
  const server = new McpServer({ name: 'danilo-professional-profile', title: 'Danilo Stoletović', version: '1.0.0', websiteUrl: site });
  const options = <T extends z.ZodType>(name: keyof typeof toolDescriptions, inputSchema: T) => ({
    description: toolDescriptions[name], inputSchema, annotations: readOnly,
  });

  server.registerTool('get_profile', options('get_profile', empty), () => response(catalogue.profile));
  server.registerTool('get_experience', options('get_experience', empty), () => response({ items: catalogue.experience }));
  server.registerTool('list_services', options('list_services', list), ({ limit }) => response(collection(catalogue.services, limit)));
  server.registerTool('list_projects', options('list_projects', projectFilter), ({ limit, category, status }) => response(collection(
    catalogue.projects.filter(project => (!category || project.category === category) && (!status || project.status === status)), limit,
  )));
  server.registerTool('get_project', options('get_project', byId), input => individual(catalogue.projects, input.id));
  server.registerTool('list_case_studies', options('list_case_studies', byProject), ({ limit, project }) => response(collection(
    catalogue['case-studies'].filter(study => !project || study.project === project), limit,
  )));
  server.registerTool('get_case_study', options('get_case_study', byId), input => individual(catalogue['case-studies'], input.id));
  server.registerTool('list_publications', options('list_publications', publicationFilter), ({ limit, status }) => response(collection(
    catalogue.publications.filter(work => !status || work.status === status), limit,
  )));
  server.registerTool('list_achievements', options('list_achievements', byProject), ({ limit, project }) => response(collection(
    catalogue.achievements.filter(item => !project || item.project === project), limit,
  )));
  server.registerTool('list_news', options('list_news', newsFilter), ({ limit, year }) => response(collection(
    catalogue.news.filter(item => !year || item.date.startsWith(year)), limit,
  )));
  server.registerTool('list_profiles', options('list_profiles', profileFilter), ({ limit, category, identity }) => response(collection(
    catalogue.links.filter(profile => (!category || profile.category === category) && (!identity || profile.identity === identity)), limit,
  )));
  server.registerTool('get_contact', options('get_contact', empty), () => response(catalogue.contact));
  server.registerTool('search_content', options('search_content', searchInput), ({ query, limit }) => response(search(query, limit)));

  for (const resource of resources) {
    const uri = resourceUri(resource.id);
    server.registerResource(resource.id, uri, {
      title: resource.title, mimeType: 'application/json',
    }, () => ({ contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(catalogue[resource.key]) }] }));
  }
  return server;
}, { legacy: 'stateless', responseMode: 'json', maxRequestBodySize, maxSubscriptions: 0 });

export async function serveMcp(request: Request, env: McpEnv): Promise<Response> {
  const origin = request.headers.get('Origin');
  const headers = new Headers({
    'Cache-Control': 'no-store, no-transform',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
    Vary: 'Origin',
  });
  const error = (status: number, message: string) => Response.json({ error: message }, { status, headers });
  if (origin) {
    const allowed = new Set([new URL(request.url).origin, site, ...(env.MCP_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean)]);
    if (!allowed.has(origin)) return error(403, 'Origin is not permitted.');
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept, MCP-Protocol-Version, MCP-Method, MCP-Name, Last-Event-ID');
    headers.set('Access-Control-Expose-Headers', 'MCP-Protocol-Version, Retry-After');
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  try {
    const { success } = await env.MCP_RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' });
    if (!success) {
      headers.set('Retry-After', '60');
      return error(429, 'Please retry in one minute.');
    }
  } catch {
    return error(503, 'MCP is temporarily unavailable.');
  }
  if (Number(request.headers.get('Content-Length')) > maxRequestBodySize) return error(413, 'Request body is too large.');
  if (request.method === 'GET' && request.headers.get('Accept')?.includes('text/html')) {
    headers.set('Location', new URL('/mcp-info/', request.url).href);
    return new Response(null, { status: 303, headers });
  }
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(8_000)]);
    const upstream = await mcp.fetch(new Request(request, { signal }));
    const merged = new Headers(upstream.headers);
    headers.forEach((value, key) => {
      if (key === 'vary' && merged.has(key)) merged.append(key, value);
      else merged.set(key, value);
    });
    return new Response(upstream.body, { status: upstream.status, headers: merged });
  } catch {
    return error(503, 'MCP is temporarily unavailable.');
  }
}
