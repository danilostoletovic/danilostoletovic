import { person, site } from '../data/public.ts';

const path = '/a2a';
export const a2a = {
  path,
  url: site + path,
  sendPath: path + '/message:send',
  cardPath: '/.well-known/agent-card.json',
  cardType: 'application/json',
  describeType: 'application/a2a-agent-card+json',
  messageType: 'application/a2a+json',
  name: `${person.name} public portfolio assistant`,
  description: 'Retrieves sourced professional information from the public portfolio catalogue using text messages. Responses are deterministic.',
  protocolBinding: 'HTTP+JSON',
  protocolVersion: '1.0',
  version: '1.0.0',
  auth: 'none',
  maxBody: 8192,
} as const;
