import * as z from 'zod/v4';
import { person, profileCategories, profileIdentities, projectCategories, projectStatuses, publicationStatuses } from '../data/public.ts';

export const entryId = z.string().max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const emptyInput = z.strictObject({});
const limit = z.number().int().min(1).max(30).optional().default(20);
const list = z.strictObject({ limit });
const byId = z.strictObject({ id: entryId });
const byProject = list.extend({ project: entryId.optional() });
const projectFilter = list.extend({
  category: z.enum(projectCategories).optional(),
  status: z.enum(projectStatuses).optional(),
});
const publicationFilter = list.extend({ status: z.enum(publicationStatuses).optional() });
const newsFilter = list.extend({ year: z.string().regex(/^\d{4}$/).optional() });
const profileFilter = list.extend({
  category: z.enum(profileCategories).optional(),
  identity: z.enum(profileIdentities).optional(),
});
const searchInput = list.extend({ query: z.string().trim().min(2).max(100) });

export const mcpTools = {
  get_profile: { description: `Retrieve ${person.name}’s professional profile, photograph, and verified public links.`, input: emptyInput },
  get_experience: { description: 'Retrieve documented independent and freelance experience.', input: emptyInput },
  list_services: { description: 'List commercial software, consulting, and deployment services.', input: list },
  list_projects: { description: 'List public projects. Filter by category or development status.', input: projectFilter },
  get_project: { description: 'Retrieve a project by its stable identifier.', input: byId },
  list_case_studies: { description: 'List case studies, optionally for one project.', input: byProject },
  get_case_study: { description: 'Retrieve a case study by its stable identifier.', input: byId },
  list_publications: { description: 'List verified publication records, optionally by publication status.', input: publicationFilter },
  list_achievements: { description: 'List verified achievements, optionally for one project.', input: byProject },
  list_news: { description: 'List public coverage and official results, optionally by year.', input: newsFilter },
  list_profiles: { description: 'List verified public profiles. Filter by category or identity type.', input: profileFilter },
  get_contact: { description: 'Retrieve the public professional email address and telephone number.', input: emptyInput },
  search_content: { description: 'Search projects, cases, services, publications, achievements, news, and public profiles.', input: searchInput },
} as const satisfies Record<string, { description: string; input: z.ZodObject }>;

export const resources = [
  { id: 'professional', key: 'profile', title: 'Professional profile', tool: 'get_profile', queries: [`What is ${person.name}’s professional background?`, `Where is ${person.name} based?`] },
  { id: 'experience', key: 'experience', title: 'Experience', tool: 'get_experience', queries: [`What kinds of software work has ${person.name} done?`, `What freelance experience does ${person.name} have?`] },
  { id: 'services', key: 'services', title: 'Services', tool: 'list_services', queries: ['What software development services are available?', `Can ${person.name} help deploy an application?`] },
  { id: 'projects', key: 'projects', title: 'Projects', tool: 'list_projects', queries: [`What apps has ${person.name} released?`, 'What is the SmartVehicle project?'] },
  { id: 'publications', key: 'publications', title: 'Publications', tool: 'list_publications', queries: [`Which papers has ${person.name} published?`, `Where can I find citation information for ${person.name}’s research?`] },
  { id: 'case-studies', key: 'case-studies', title: 'Case studies', tool: 'list_case_studies', queries: ['What engineering case studies are available?', 'How was SmartVehicle implemented?'] },
  { id: 'achievements', key: 'achievements', title: 'Achievements', tool: 'list_achievements', queries: [`Which awards has ${person.name} earned?`, 'Where are official competition results documented?'] },
  { id: 'news', key: 'news', title: 'News and recognition', tool: 'list_news', queries: [`Where has ${person.name}’s work been covered?`, 'Which public reports mention the software projects?'] },
  { id: 'links', key: 'links', title: 'Public profiles', tool: 'list_profiles', queries: [`What are ${person.name}’s verified public profiles?`, `Where can I find ${person.name}’s source repositories?`] },
  { id: 'contact', key: 'contact', title: 'Professional contact', tool: 'get_contact', queries: [`What is ${person.name}’s public professional email?`, `How can I contact ${person.name} about a project?`] },
] as const satisfies readonly { id: string; key: string; title: string; tool: keyof typeof mcpTools; queries: readonly string[] }[];

export const resourceUri = (id: string) => `profile://${id}`;
export const resourcePath = (key: string) => `/${key}.json`;
