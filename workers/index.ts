import { serveMcp, type McpEnv } from './mcp';

interface Env extends McpEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  fetch(request: Request, env: Env) {
    const path = new URL(request.url).pathname;
    if (path === '/mcp' || path === '/mcp/') return serveMcp(request, env);
    return env.ASSETS.fetch(request);
  },
};
