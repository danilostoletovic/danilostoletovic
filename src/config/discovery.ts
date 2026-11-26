import { site } from './site.ts';

export const discovery = {
  ard: { path: '/.well-known/ard.json', type: 'application/json', rel: 'ard' },
  apiCatalog: { path: '/.well-known/api-catalog', type: 'application/linkset+json', rel: 'api-catalog' },
  aiCatalog: { path: '/.well-known/ai-catalog.json', type: 'application/ai-catalog+json' },
  openapi: { path: '/openapi.json', type: 'application/json', rel: 'service-desc' },
  skills: { path: '/.well-known/agent-skills/index.json', type: 'application/json' },
  skillsSchema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
  integrationGuide: { path: '/mcp-info/', type: 'text/html', rel: 'service-doc' },
  webmcp: { path: '/webmcp.json', type: 'application/json' },
  sitemap: '/sitemap.xml',
  markdownType: 'text/markdown',
} as const;

export const contentSignals = { search: 'yes', 'ai-input': 'yes', 'ai-train': 'yes' } as const satisfies Record<'search' | 'ai-input' | 'ai-train', 'yes' | 'no'>;
const crawlerPaths = { disallow: ['/cdn-cgi/'] } as const;
export const contentSignal = Object.entries(contentSignals).map(([key, value]) => `${key}=${value}`).join(', ');

export function robotsText() {
  const restrictions = crawlerPaths.disallow.map(path => 'Disallow: ' + path).join('\n');
  return `User-agent: *\nAllow: /\n${restrictions}\nContent-Signal: ${contentSignal}\n\nSitemap: ${site + discovery.sitemap}\n`;
}

export const absolute = (path: string) => new URL(path, site).href;
