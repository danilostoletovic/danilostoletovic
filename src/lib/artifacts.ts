import { catalogue, directories, mcpUrl, publicProfile, publicationReference } from './catalogue';
import { person, site, type Entry } from '../data/public';
import { citationLinks } from './citations';

export const xml = (value: string) => value.replace(/[<>&"']/g, character => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
}[character] ?? character));

const formatLink = (label: string, href: string) => `[${label}](${href})`;
const entryMarkdown = (entry: Entry & { url?: string }) =>
  `- ${entry.url ? formatLink(entry.title, entry.url) : entry.title} — ${entry.summary} Sources: ${entry.sources.map(source => formatLink(source.label, source.url)).join(', ')}.`;
const listMarkdown = (heading: string, entries: readonly (Entry & { url?: string })[]) =>
  entries.length ? `## ${heading}\n\n${entries.map(entryMarkdown).join('\n')}\n` : '';

function publicationMarkdown() {
  return listMarkdown('Publications', catalogue.publications.map(work => ({
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
    `Also known as ${person.alternateNames.join(' and ')}. Based in ${person.location}.\n\nWebsite: ${site}/\n\nEmail: ${person.email}\n\nTelephone: ${person.telephone}\n`,
    listMarkdown('Experience', publicProfile.experience),
    listMarkdown('Education', publicProfile.education),
    publicationMarkdown(),
    '## Technical capabilities\n\n' + publicProfile.skills.map(group => `- ${group.title}: ${group.items.join(', ')}`).join('\n') + '\n',
    listMarkdown('Public profiles', catalogue.links.filter(profile => profile.identity === 'personal')),
    listMarkdown('Project organizations', catalogue.links.filter(profile => profile.identity === 'project')),
    `## Model Context Protocol\n\nStreamable HTTP endpoint: ${mcpUrl}\n\nDocumentation: ${site}/mcp-info/\n`,
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
    `- ${formatLink('MCP documentation', site + '/mcp-info/')}: Streamable HTTP at ${mcpUrl}.`,
    '',
  ].join('\n');
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
  profile: `# ${person.name}\n\n${person.title}\n\n${person.summary}\n\nProfessional email: ${person.email}\n\nProfessional telephone: ${person.telephone}\n\nORCID: ${publicProfile.orcidUrl}\n\n${publicationMarkdown()}\nPricing, availability, and delivery commitments are confirmed directly. The budget planner supplies scope examples.\n`,
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
