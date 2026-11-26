import { serveMcp, type McpEnv } from './mcp';
import { mcpService } from '../src/config/mcp';
import { servePage } from './markdown';
import { a2a } from '../src/config/a2a';
import { serveA2a } from './a2a';
import type { RateLimit } from '@cloudflare/workers-types';

interface Env extends McpEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  A2A_RATE_LIMITER: RateLimit;
}

export default {
  fetch(request: Request, env: Env) {
    const path = new URL(request.url).pathname;
    if (path === mcpService.path || path === mcpService.path + '/') return serveMcp(request, env);
    if (path.startsWith(a2a.path + '/')) return serveA2a(request, env.A2A_RATE_LIMITER);
    return servePage(request, env.ASSETS);
  },
};
