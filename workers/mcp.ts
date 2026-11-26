import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import type * as z from 'zod/v4';
import type { RateLimit } from '@cloudflare/workers-types';
import { catalogue } from '../src/lib/catalogue';
import { resources, resourceUri, mcpTools } from '../src/lib/mcp-surface';
import { mcpService } from '../src/config/mcp';
import { discovery } from '../src/config/discovery';
import { filterProjects } from '../src/lib/project-filter';
import { site } from '../src/data/public';

export interface McpEnv {
  MCP_RATE_LIMITER: RateLimit;
  MCP_ALLOWED_ORIGINS?: string;
}

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
  const server = new McpServer(mcpService.identity);
  const options = <T extends z.ZodType>(tool: { description: string; input: T }) => ({
    description: tool.description, inputSchema: tool.input,
    annotations: readOnly,
  });

  server.registerTool('get_profile', options(mcpTools.get_profile), () => response(catalogue.profile));
  server.registerTool('get_experience', options(mcpTools.get_experience), () => response({ items: catalogue.experience }));
  server.registerTool('list_services', options(mcpTools.list_services), ({ limit }) => response(collection(catalogue.services, limit)));
  server.registerTool('list_projects', options(mcpTools.list_projects), ({ limit, category, status }) => response(collection(
    filterProjects(catalogue.projects, { category, status }), limit,
  )));
  server.registerTool('get_project', options(mcpTools.get_project), input => individual(catalogue.projects, input.id));
  server.registerTool('list_case_studies', options(mcpTools.list_case_studies), ({ limit, project }) => response(collection(
    catalogue['case-studies'].filter(study => !project || study.project === project), limit,
  )));
  server.registerTool('get_case_study', options(mcpTools.get_case_study), input => individual(catalogue['case-studies'], input.id));
  server.registerTool('list_publications', options(mcpTools.list_publications), ({ limit, status }) => response(collection(
    catalogue.publications.filter(work => !status || work.status === status), limit,
  )));
  server.registerTool('list_achievements', options(mcpTools.list_achievements), ({ limit, project }) => response(collection(
    catalogue.achievements.filter(item => !project || item.project === project), limit,
  )));
  server.registerTool('list_news', options(mcpTools.list_news), ({ limit, year }) => response(collection(
    catalogue.news.filter(item => !year || item.date.startsWith(year)), limit,
  )));
  server.registerTool('list_profiles', options(mcpTools.list_profiles), ({ limit, category, identity }) => response(collection(
    catalogue.links.filter(profile => (!category || profile.category === category) && (!identity || profile.identity === identity)), limit,
  )));
  server.registerTool('get_contact', options(mcpTools.get_contact), () => response(catalogue.contact));
  server.registerTool('search_content', options(mcpTools.search_content), ({ query, limit }) => response(search(query, limit)));

  for (const resource of resources) {
    const uri = resourceUri(resource.id);
    server.registerResource(resource.id, uri, {
      title: resource.title, mimeType: 'application/json',
    }, () => ({ contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(catalogue[resource.key]) }] }));
  }
  return server;
}, { legacy: 'stateless', responseMode: 'json', maxRequestBodySize: mcpService.maxBody, maxSubscriptions: 0 });

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
  if (Number(request.headers.get('Content-Length')) > mcpService.maxBody) return error(413, 'Request body is too large.');
  if (request.method === 'GET' && request.headers.get('Accept')?.includes('text/html')) {
    headers.set('Location', new URL(discovery.integrationGuide.path, request.url).href);
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
