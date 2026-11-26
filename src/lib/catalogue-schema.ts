import * as z from 'zod/v4';
import { profileCategories, profileIdentities, projectCategories, projectStatuses, publicationStatuses } from '../data/public.ts';
import { entryId } from './mcp-surface.ts';
import type { catalogue } from './catalogue.ts';

const text = z.string().min(1);
const webUrl = z.url({ protocol: /^https$/ });
const source = z.strictObject({ label: text, url: webUrl });
const entry = z.strictObject({ id: entryId, title: text, summary: text, sources: z.array(source).min(1) });
const date = z.string().regex(/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/);
const link = entry.extend({
  username: text, category: z.enum(profileCategories), url: webUrl, identity: z.enum(profileIdentities),
  icon: text, primary: z.boolean().optional(),
});
const publication = entry.extend({
  authors: z.array(text).min(1),
  authorDetails: z.array(z.strictObject({ givenName: text, familyName: text, orcid: text.optional(), orcidUrl: webUrl.optional() })).min(1),
  date, venue: text, status: z.enum(publicationStatuses), doi: text.optional(), doiUrl: webUrl.optional(),
  doiRegistration: z.literal('pending').optional(), publicationType: z.literal('Original scientific paper').optional(),
  proceedings: z.strictObject({ isbn: text, firstPage: z.number().int().positive(), location: text, organizers: z.array(text).min(1), format: z.literal('Print') }).optional(),
  project: entryId.optional(), url: webUrl,
});
const email = z.email();
const telephone = z.string().regex(/^\+[1-9]\d{1,14}$/);
const contact = z.strictObject({ email, telephone, url: webUrl });
const pixels = z.number().int().positive();
const imageAsset = z.strictObject({ url: webUrl, width: pixels, height: pixels, mimeType: z.enum(['image/jpeg', 'image/avif', 'image/webp']) });
const profile = z.strictObject({
  givenName: text, familyName: text, name: text, alternateNames: z.array(text), title: text, location: text,
  orcid: text, orcidUrl: webUrl, telephone, email, summary: text, portrait: webUrl, sources: z.array(source),
  image: imageAsset.extend({ alt: text, subject: text, caption: text, purpose: text, alternatives: z.array(imageAsset).min(1) }),
  site: webUrl, contact, profiles: z.array(link), experience: z.array(entry), education: z.array(entry),
  skills: z.array(z.strictObject({ title: text, items: z.array(text) })), publications: z.array(publication),
});

export const catalogueSchemas = {
  profile,
  experience: z.array(entry),
  projects: z.array(entry.extend({
    status: z.enum(projectStatuses), category: z.enum(projectCategories), stack: z.array(text), role: text,
    includeInCv: z.boolean().optional(), links: z.array(source), url: webUrl,
    image: z.strictObject({ file: text, alt: text, width: z.number().int().positive(), height: z.number().int().positive() }).optional(),
  })),
  'case-studies': z.array(entry.extend({
    project: entryId, relevantToClients: z.boolean().optional(), problem: text, constraints: text, decisions: text,
    implementation: text, results: text, lessons: text, url: webUrl,
  })),
  publications: z.array(publication),
  services: z.array(entry.extend({ deliverables: z.array(text) })),
  achievements: z.array(entry.extend({ organizer: text, date, project: entryId.optional() })),
  news: z.array(entry.extend({ publisher: text, date, url: webUrl, mention: z.enum(['Direct', 'Project']), project: entryId.optional() })),
  links: z.array(link),
  contact,
} satisfies Record<keyof typeof catalogue, z.ZodType>;

export function jsonSchema(schema: z.ZodType, options: { io: 'input' | 'output' }) {
  const { $schema, ...document } = z.toJSONSchema(schema, options);
  return document;
}
