import { catalogue, cv, directories, mcpUrl, publicProfile, publicationReference } from './catalogue.ts';
import { collaboration, person, site, type Entry } from '../data/public.ts';
import { citationLinks } from './citations.ts';
import { absolute, discovery } from '../config/discovery.ts';
import { mcpService } from '../config/mcp.ts';
import { a2a } from '../config/a2a.ts';
import { mcpTools, resourceUri, resources } from './mcp-surface.ts';

export const xml = (value: string) => value.replace(/[<>&"']/g, character => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
}[character] ?? character));

const formatLink = (label: string, href: string) => `[${label}](${href})`;
const portraitLink = formatLink(person.image.caption, person.image.url);
const entryMarkdown = (entry: Entry & { url?: string }) =>
  `- ${entry.url ? formatLink(entry.title, entry.url) : entry.title} — ${entry.summary} Sources: ${entry.sources.map(source => formatLink(source.label, source.url)).join(', ')}.`;
const listMarkdown = (heading: string, entries: readonly (Entry & { url?: string })[]) =>
  entries.length ? `## ${heading}\n\n${entries.map(entryMarkdown).join('\n')}\n` : '';

function publicationMarkdown(works = catalogue.publications) {
  return listMarkdown('Publications', works.map(work => ({
    ...work,
    summary: [
      publicationReference(work) + '.',
      work.proceedings && `Conference organizers: ${work.proceedings.organizers.join(', ')}.`,
      work.doiUrl && formatLink('DOI', work.doiUrl) + '.',
      work.status === 'Published' && citationLinks(work).map(link => formatLink(link.label, site + link.path)).join(' · ') + '.',
    ].filter(Boolean).join(' '),
  })));
}

export function profileMarkdown() {
  return [
    `# ${person.name}\n\n${person.title}\n\n${person.summary}\n`,
    `${portraitLink}\n`,
    `Also known as ${person.alternateNames.join(' and ')}. Based in ${person.location}.\n\nWebsite: ${site}/\n\nEmail: ${person.email}\n\nTelephone: ${person.telephone}\n`,
    listMarkdown('Experience', publicProfile.experience),
    listMarkdown('Education', publicProfile.education),
    publicationMarkdown(),
    '## Technical capabilities\n\n' + publicProfile.skills.map(group => `- ${group.title}: ${group.items.join(', ')}`).join('\n') + '\n',
    listMarkdown('Public profiles', catalogue.links.filter(profile => profile.identity === 'personal')),
    listMarkdown('Project organizations', catalogue.links.filter(profile => profile.identity === 'project')),
    `## Model Context Protocol\n\nStreamable HTTP endpoint: ${mcpUrl}\n\nDocumentation: ${absolute(discovery.integrationGuide.path)}\n`,
  ].join('\n');
}

export function textCatalogue() {
  return [
    profileMarkdown(),
    listMarkdown('Services', catalogue.services.map(service => ({ ...service, url: `${site}/commerce/${service.id}/` }))),
    listMarkdown('Projects', catalogue.projects.map(project => ({
      ...project,
      summary: `${project.summary} Status: ${project.status}. Contribution: ${project.role} Technologies: ${project.stack.join(', ')}. ${project.links.map(link => formatLink(link.label, link.url)).join(' · ')}.`,
    }))),
    listMarkdown('Case studies', catalogue['case-studies'].map(study => ({
      ...study,
      summary: `${study.summary} Problem: ${study.problem} Constraints: ${study.constraints} Design: ${study.decisions} Implementation: ${study.implementation} Results: ${study.results} Lessons: ${study.lessons}`,
    }))),
    listMarkdown('Achievements', catalogue.achievements),
    listMarkdown('News and recognition', catalogue.news),
  ].filter(Boolean).join('\n');
}

export function llmsIndex() {
  return [
    `# ${person.name}\n\n> ${person.title}. ${person.summary}\n`,
    `- ${portraitLink}\n`,
    `## Professional contact\n\n- Email: ${person.email}\n- Telephone: ${person.telephone}\n`,
    `## Research identity\n\n- ${formatLink('ORCID ' + person.orcid, publicProfile.orcidUrl)}\n`,
    publicationMarkdown(),
    '## Website\n',
    ...directories.map(item => `- ${formatLink(item.title, site + item.href)}: ${item.summary}.`),
    `- ${formatLink('Public profiles', site + '/links/')}: Verified profiles and project organizations.\n`,
    '## Machine-readable formats\n',
    `- ${formatLink('Complete text catalogue', site + '/llms-full.txt')}`,
    `- ${formatLink('Professional identity in Markdown', site + '/profile.md')}`,
    `- ${formatLink('Public catalogue in JSON', site + '/mcp-data.json')}`,
    `- ${formatLink('MCP documentation', absolute(discovery.integrationGuide.path))}: Streamable HTTP at ${mcpUrl}.`,
    `- ${formatLink('ARD manifest', absolute(discovery.ard.path))}`,
    `- ${formatLink('API catalog', absolute(discovery.apiCatalog.path))}`,
    `- ${formatLink('Agent Skills index', absolute(discovery.skills.path))}`,
    '',
  ].join('\n');
}

export function pageMarkdown() {
  const serviceEntries = catalogue.services.map(service => ({ ...service, url: absolute(`/commerce/${service.id}/`) }));
  const document = (title: string, parts: readonly string[]) => `# ${title}\n\n${parts.filter(Boolean).join('\n\n')}\n`;
  const pages = new Map<string, string>([
    ['/', profileMarkdown()],
    ['/commerce/', document('Commercial work', [
      listMarkdown('Services', serviceEntries),
      '## How we work together\n\n' + collaboration.map(item => `- **${item.title}** — ${item.summary}`).join('\n'),
      listMarkdown('Case studies', catalogue['case-studies'].filter(study => study.relevantToClients)),
      `Email ${person.email} or call ${person.telephone} for scope, quotes, and availability. [Budget estimator and Ana](${absolute('/commerce/')}).`,
    ])],
    ['/academia/', document('Academic work', [
      publicationMarkdown(), listMarkdown('Research projects', catalogue.projects.filter(item => item.category === 'Robotics')),
      listMarkdown('Competitions and awards', catalogue.achievements), listMarkdown('Education', publicProfile.education),
      formatLink('ORCID', publicProfile.orcidUrl),
    ])],
    ['/side-projects/', document('Independent projects', [listMarkdown('Projects', catalogue.projects)])],
    ['/case/', document('Case studies', [listMarkdown('Engineering case studies', catalogue['case-studies'])])],
    ['/news/', document('News and recognition', [listMarkdown('Public coverage', catalogue.news), formatLink('RSS feed', absolute('/rss.xml'))])],
    ['/links/', document('Public profiles', [portraitLink, listMarkdown('Profiles and project organizations', catalogue.links)])],
    ['/cv/', document(cv.name, [
      `${cv.title} · ${cv.location}\n\n${cv.summary}\n\n${cv.email} · ${cv.telephone}\n\n${formatLink('Download CV (PDF)', absolute('/cv.pdf'))}`,
      portraitLink,
      ...cv.sections.filter(section => section.items.length).map(section =>
        `## ${section.title}\n\n${section.items.map(item => `- **${item.title}** — ${item.summary}`).join('\n')}`),
    ])],
    [discovery.integrationGuide.path, document('Model Context Protocol', [
      mcpService.description,
      `Connect an MCP client to ${mcpUrl} over Streamable HTTP. Public reads require no credentials.`,
      '## Tools\n\n' + Object.entries(mcpTools).map(([name, { description }]) => `- \`${name}\` — ${description}`).join('\n'),
      '## Resources\n\n' + resources.map(resource => `- ${resource.title} — \`${resourceUri(resource.id)}\``).join('\n'),
      `## A2A\n\n${formatLink('Agent Card', absolute(a2a.cardPath))}. Send a standalone text message to \`POST ${a2a.sendPath}\` with \`A2A-Version: ${a2a.protocolVersion}\`.`,
      [discovery.ard, discovery.apiCatalog, discovery.skills].map(item => formatLink(item.path, absolute(item.path))).join(' · '),
    ])],
  ]);
  const sources = (entry: Entry) => listMarkdown('Sources', [entry]);
  for (const service of serviceEntries) {
    pages.set(new URL(service.url).pathname, document(service.title, [
      service.summary, '## Deliverables\n\n' + service.deliverables.map(item => `- ${item}`).join('\n'), sources(service),
    ]));
  }
  for (const project of catalogue.projects) {
    pages.set(new URL(project.url).pathname, document(project.title, [
      project.summary, `${project.category} · ${project.status}`, project.role,
      `Technologies: ${project.stack.join(', ')}`, project.links.map(link => formatLink(link.label, link.url)).join(' · '), sources(project),
    ]));
  }
  for (const study of catalogue['case-studies']) {
    pages.set(new URL(study.url).pathname, document(study.title, [
      study.summary,
      ...(['problem', 'constraints', 'decisions', 'implementation', 'results', 'lessons'] as const).map(key => `## ${key[0].toUpperCase() + key.slice(1)}\n\n${study[key]}`),
      sources(study),
    ]));
  }
  for (const publication of catalogue.publications) {
    pages.set(new URL(publication.url).pathname, document(publication.title, [publication.summary, publicationMarkdown([publication])]));
  }
  return pages;
}

export function newsRss() {
  const items = catalogue.news.map(item => {
    const anchor = `${site}/news/#${item.id}`;
    const date = item.date.length === 10 ? `<pubDate>${new Date(item.date).toUTCString()}</pubDate>` : '';
    return `<item><title>${xml(item.title)}</title><link>${xml(item.url)}</link><guid isPermaLink="false">${anchor}</guid><description>${xml(item.summary)}</description>${date}</item>`;
  });
  return `<?xml version="1.0" encoding="utf-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xml(person.name)} — News and recognition</title><link>${site}/news/</link><description>Media coverage and official results.</description><language>en</language><atom:link href="${site}/rss.xml" rel="self" type="application/rss+xml"/>\n${items.join('\n')}\n</channel></rss>\n`;
}

export const anaKnowledge = {
  profile: `# ${person.name}\n\n${person.title}\n\n${person.summary}\n\n${portraitLink}\n\nProfessional email: ${person.email}\n\nProfessional telephone: ${person.telephone}\n\nORCID: ${publicProfile.orcidUrl}\n\n${publicationMarkdown()}\nPricing, availability, and delivery commitments are confirmed directly. The budget planner supplies scope examples.\n`,
  services: {
    schemaVersion: 1,
    services: catalogue.services.map(service => ({ id: service.id, name: service.title, description: service.summary, available: true })),
  },
  projects: {
    schemaVersion: 1,
    projects: catalogue.projects.map(project => ({
      id: project.id, name: project.title, description: project.summary, technologies: project.stack,
      features: [project.status, project.role], links: project.links,
    })),
  },
};
