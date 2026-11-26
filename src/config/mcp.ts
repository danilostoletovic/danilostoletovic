import { person, site } from '../data/public.ts';

const path = '/mcp';
export const mcpService = {
  path,
  url: site + path,
  cardPath: `${path}/server-card`,
  cardType: 'application/mcp-server-card+json',
  cardSchema: 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
  description: `Read-only MCP server for ${person.name}’s verified public professional catalogue.`,
  identity: { name: 'com.danilostoletovic/danilo-professional-profile', title: person.name, version: '1.0.0', websiteUrl: site },
  transport: 'streamable-http',
  protocolVersions: ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26'],
  auth: 'none',
  maxBody: 16 * 1024,
} as const;
