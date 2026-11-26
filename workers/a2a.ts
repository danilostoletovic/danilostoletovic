import type { RateLimit } from '@cloudflare/workers-types';
import * as z from 'zod/v4';
import { a2a } from '../src/config/a2a';
import { absolute } from '../src/config/discovery';
import { catalogue } from '../src/lib/catalogue';
import { resourcePath, resources } from '../src/lib/mcp-surface';

const message = z.object({
  message: z.object({
    messageId: z.string().min(1).max(120), role: z.literal('ROLE_USER'),
    parts: z.array(z.object({ text: z.string().trim().min(1).max(1600) })).min(1).max(4),
    taskId: z.string().optional(), contextId: z.string().optional(),
  }),
  configuration: z.object({ acceptedOutputModes: z.array(z.string()).max(16).optional() }).optional(),
});
const tooLarge = Symbol('request body exceeds limit');

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

function answer(request: string) {
  const query = normalize(request).replace(/[.!?]+$/, '');
  const [command] = query.split(':', 1);
  const term = query.slice(command.length + 1).trim();
  const resource = resources.find(item => [item.key, item.title, ...item.queries]
    .some(name => normalize(name).replace(/[.!?]+$/, '') === command.trim()));
  if (!resource) {
    return `Public catalogue topics: ${resources.map(item => item.key).join(', ')}. Send a topic, or a topic followed by a colon and a search term, such as "projects: SmartVehicle".`;
  }
  const url = absolute(resourcePath(resource.key));
  const snapshot = catalogue[resource.key];
  if ('name' in snapshot) return `${snapshot.name} — ${snapshot.title}\n${snapshot.location}\n${snapshot.summary}\n${snapshot.image.caption}: ${snapshot.image.url}\n${url}`;
  if ('email' in snapshot) return `${snapshot.email}\n${snapshot.telephone}\n${snapshot.url}`;
  const items = snapshot.filter(item => normalize(`${item.id} ${item.title} ${item.summary}`).includes(term));
  const rows = items.slice(0, 5).map(item => `- ${item.title} — ${item.summary}\n  Source: ${item.sources[0]?.url}`);
  return [
    resource.title,
    ...rows,
    rows.length ? `Showing ${rows.length} of ${items.length}. Complete catalogue: ${url}` : `No matching public entries. Complete catalogue: ${url}`,
  ].join('\n');
}

async function readMessage(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return;
  const bytes = new Uint8Array(a2a.maxBody);
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length))) as unknown;
      if (length + value.length > bytes.length) {
        void reader.cancel().catch(() => {});
        return tooLarge;
      }
      bytes.set(value, length);
      length += value.length;
    }
  } catch {
    return undefined;
  } finally {
    reader.releaseLock();
  }
}

export async function serveA2a(request: Request, rateLimiter: RateLimit) {
  const url = new URL(request.url);
  const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' });
  const sendJson = (body: unknown, status = 200, contentType: string = a2a.messageType) => {
    headers.set('Content-Type', contentType);
    return new Response(JSON.stringify(body), { status, headers });
  };
  const problem = (status: number, title: string, slug?: string, extra = {}) =>
    sendJson({ type: slug ? 'https://a2a-protocol.org/errors/' + slug : 'about:blank', title, status, ...extra }, status, 'application/problem+json');

  if (request.headers.has('Origin') && request.headers.get('Origin') !== url.origin) return problem(403, 'Origin is not permitted');
  try {
    const { success } = await rateLimiter.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' });
    if (!success) {
      headers.set('Retry-After', '60');
      return problem(429, 'Rate limit exceeded');
    }
  } catch {
    return problem(503, 'Public assistant temporarily unavailable');
  }
  if ((request.headers.get('A2A-Version') ?? url.searchParams.get('A2A-Version') ?? '0.3') !== a2a.protocolVersion) {
    return problem(400, 'Protocol version not supported', 'version-not-supported', { supportedVersions: [a2a.protocolVersion] });
  }
  headers.set('A2A-Version', a2a.protocolVersion);
  if (url.pathname === a2a.path + '/tasks' && request.method === 'GET') return sendJson({ tasks: [], nextPageToken: '', pageSize: 0, totalSize: 0 });
  if (url.pathname !== a2a.sendPath) {
    const method = request.method;
    if (url.pathname === a2a.path + '/extendedAgentCard' || url.pathname === a2a.path + '/message:stream' ||
        /^\/a2a\/tasks\/[^/]+(?::subscribe|\/pushNotificationConfigs(?:\/[^/]+)?)$/.test(url.pathname)) {
      return problem(400, 'Operation not supported', 'unsupported-operation');
    }
    if (/^\/a2a\/tasks\/[^/]+$/.test(url.pathname) && (method === 'GET' || method === 'POST')) {
      return problem(404, 'Task not found', 'task-not-found');
    }
    return problem(404, 'Path not found');
  }
  if (request.method !== 'POST') {
    headers.set('Allow', 'POST');
    return problem(405, 'Use POST for SendMessage');
  }
  const contentType = request.headers.get('Content-Type')?.split(';', 1)[0].toLowerCase().trim();
  if (contentType !== a2a.messageType && contentType !== 'application/json') return problem(415, 'Expected an A2A JSON request');
  if (Number(request.headers.get('Content-Length')) > a2a.maxBody) return problem(413, 'Request body is too large');
  const json = await readMessage(request);
  if (json === tooLarge) return problem(413, 'Request body is too large');
  const payload = message.safeParse(json);
  if (!payload.success) return problem(400, 'Expected an A2A user message with text parts and a message ID');
  const { message: input, configuration } = payload.data;
  if (input.taskId) return problem(404, 'Task not found', 'task-not-found');
  if (input.contextId) return problem(400, 'This interface accepts standalone messages');
  const accept = configuration?.acceptedOutputModes;
  if (accept?.length && !accept.includes('text/plain')) return problem(400, 'Only text/plain replies are available', 'content-type-not-supported');
  return sendJson({ message: {
    messageId: crypto.randomUUID(), role: 'ROLE_AGENT', parts: [{ text: answer(input.parts.map(part => part.text).join(' ')) }],
  } });
}
